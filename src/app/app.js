/**
 * Main Application Orchestrator.
 * Wires together feature modules (Media, Signaling, Call Engine, Chat, Diagnostics, Room Lobby).
 * Supports Google Meet style multi-participant mesh calling, dynamic video grid,
 * spotlight center-stage pinning, and reliable screen sharing.
 */

import { Logger } from '../shared/utils/logger.js';
import { generatePeerId, generateRoomId } from '../shared/utils/id.js';
import { sound } from '../shared/utils/sound.js';
import { toast } from '../shared/ui/toast.js';

import { mediaDeviceService, mediaState, AudioLevelAnalyser, openDeviceSettingsModal } from '../features/media/index.js';
import { WebSocketSignalingClient, BroadcastSignalingClient } from '../features/signaling/index.js';
import { PeerConnectionEngine, callState, CallStatus, CallStatsCollector, VideoGrid, CallControls, CallHeader } from '../features/call/index.js';
import { DataChannelManager, ChatDrawer } from '../features/chat/index.js';
import { StatsModal } from '../features/diagnostics/index.js';
import { RoomLobby } from '../features/room/index.js';

// Expose ID generators to window for Lobby dynamic room generation
window.__WEBRTC_UTILS__ = { generateRoomId, generatePeerId };

export class WebRTCApplication {
  constructor(rootElement) {
    this.root = rootElement;
    this.logger = new Logger('App');

    this.peerId = generatePeerId();
    this.roomId = this.extractRoomFromUrl() || generateRoomId();
    this.nickname = 'User';

    this.signaling = null;
    this.signalingMode = 'websocket'; // 'websocket' | 'broadcast'

    // Multi-peer Map: peerId -> { peerId, nickname, peerConnection, statsCollector, audioAnalyser, stream, mediaState }
    this.peers = new Map();

    this.dataChannelManager = new DataChannelManager();

    // Local audio level detector for speaking indicator
    this.localAudioAnalyser = new AudioLevelAnalyser();

    // UI Components
    this.lobby = null;
    this.callHeader = null;
    this.videoGrid = null;
    this.callControls = null;
    this.chatDrawer = null;
    this.statsModal = new StatsModal();
  }

  extractRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || params.get('join') || '';
  }

  async init() {
    this.logger.info(`Initializing WebRTC Application as peer ${this.peerId}`);

    // Build the Shell DOM structure
    this.root.innerHTML = `
      <div class="app-shell" id="app-shell">
        <div id="nav-container"></div>
        <main class="main-stage" id="stage-container">
          <div id="lobby-container" style="width:100%; height:100%; display:flex;"></div>
          <div id="call-container" style="width:100%; height:100%; display:none;"></div>
        </main>
        <div id="drawer-container"></div>
      </div>
    `;

    this.navContainer = this.root.querySelector('#nav-container');
    this.lobbyContainer = this.root.querySelector('#lobby-container');
    this.callContainer = this.root.querySelector('#call-container');
    this.drawerContainer = this.root.querySelector('#drawer-container');

    // Instantiate Chat Drawer
    this.chatDrawer = new ChatDrawer({
      onSendMessage: (text) => {
        if (this.dataChannelManager) {
          const msg = this.dataChannelManager.sendMessage(text, this.nickname);
          if (msg) this.chatDrawer.appendMessage(msg);
        }
      },
      onClose: () => {
        callState.set({ unreadMessagesCount: 0 });
        this.callControls?.updateUnreadCount(0);
      }
    });
    this.drawerContainer.appendChild(this.chatDrawer.render());

    // Wire up incoming chat messages from any peer
    this.dataChannelManager.on('message', (msg) => {
      this.chatDrawer?.appendMessage(msg);
      if (!this.chatDrawer?.isOpen) {
        const count = callState.get().unreadMessagesCount + 1;
        callState.set({ unreadMessagesCount: count });
        this.callControls?.updateUnreadCount(count);
      }
    });

    // Instantiate Lobby
    this.lobby = new RoomLobby({
      initialRoomId: this.roomId,
      initialNickname: this.nickname,
      onJoinRoom: (data) => this.handleJoinRoom(data),
      onToggleAudio: () => this.handleToggleAudio(),
      onToggleVideo: () => this.handleToggleVideo(),
      onOpenSettings: () => this.handleOpenSettings(),
      onModeChange: (mode) => { this.signalingMode = mode; }
    });
    this.lobbyContainer.appendChild(this.lobby.render());

    // Setup Local Audio Analyser for VAD speaking indicators
    this.localAudioAnalyser.on('level', (level) => {
      this.lobby?.updateMicLevel(level);
    });

    this.localAudioAnalyser.on('speaking', (isSpeaking) => {
      callState.set({ isLocalSpeaking: isSpeaking });
      this.videoGrid?.updateLocalState({
        ...mediaState.get(),
        isSpeaking
      });
    });

    // Acquire initial camera & mic preview
    await this.startMediaPreview();
  }

  async startMediaPreview() {
    try {
      const stream = await mediaDeviceService.getLocalStream();
      this.lobby?.setPreviewStream(stream);
      this.localAudioAnalyser.attachStream(stream);

      // Enumerate available hardware devices
      const devices = await mediaDeviceService.getAvailableDevices();
      mediaState.setDevices(devices);
      if (stream.getAudioTracks()[0]) {
        mediaState.setActiveAudioDevice(stream.getAudioTracks()[0].getSettings().deviceId);
      }
      if (stream.getVideoTracks()[0]) {
        mediaState.setActiveVideoDevice(stream.getVideoTracks()[0].getSettings().deviceId);
      }
    } catch (err) {
      this.logger.warn('Media preview error:', err.message);
      toast.warning(err.message);
    }
  }

  async handleJoinRoom({ nickname, roomId, mode }) {
    this.nickname = nickname;
    this.roomId = roomId;
    this.signalingMode = mode;

    callState.set({
      roomId,
      peerId: this.peerId,
      nickname
    });

    // Update URL history without page reload so room link can be easily shared
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    window.history.replaceState({}, '', newUrl);

    // Initialize Signaling Client
    this.initSignaling();

    // Transition UI to In-Call Stage
    this.renderCallStage();
  }

  initSignaling() {
    if (this.signaling) {
      this.signaling.disconnect();
    }

    if (this.signalingMode === 'broadcast') {
      this.logger.info('Using BroadcastChannel signaling for instant multi-tab testing');
      this.signaling = new BroadcastSignalingClient();
    } else {
      this.logger.info('Using WebSocket signaling server');
      this.signaling = new WebSocketSignalingClient();
    }

    this.signaling.on('connected', () => {
      this.signaling.joinRoom(this.roomId, this.peerId, { nickname: this.nickname });
    });

    // When we join, the server provides the list of all peers already in this room
    this.signaling.on('joined', ({ existingPeers }) => {
      this.logger.info(`Joined room "${this.roomId}". Existing participants: ${existingPeers.length}`);
      
      const totalParticipants = existingPeers.length + 1;
      this.callHeader?.updateParticipantCount(totalParticipants);

      if (existingPeers.length > 0) {
        toast.info(`Joined room "${this.roomId}". Connecting to ${existingPeers.length} ${existingPeers.length === 1 ? 'participant' : 'participants'}...`);
        // Establish WebRTC PeerConnection with each existing participant in mesh
        for (const remotePeer of existingPeers) {
          this.setupPeerConnection(remotePeer.peerId, remotePeer.metadata);
        }
      } else {
        toast.info(`Joined room "${this.roomId}". Waiting for participants to join...`);
      }
    });

    // When another peer joins the room
    this.signaling.on('peer-joined', ({ peerId, metadata }) => {
      if (peerId === this.peerId) return;

      toast.success(`${metadata?.nickname || 'Participant'} joined the room`);
      sound.playConnect();

      this.setupPeerConnection(peerId, metadata);
      this.callHeader?.updateParticipantCount(this.peers.size + 1);
    });

    // When a peer leaves the room
    this.signaling.on('peer-left', ({ peerId }) => {
      const peer = this.peers.get(peerId);
      const name = peer?.nickname || 'Participant';
      toast.info(`${name} left the call`);
      sound.playHangup();

      this.cleanupPeer(peerId);
      this.callHeader?.updateParticipantCount(this.peers.size + 1);
    });

    // WebRTC Signaling: Offer
    this.signaling.on('offer', async ({ senderPeerId, offer }) => {
      let peer = this.peers.get(senderPeerId);
      if (!peer) {
        peer = this.setupPeerConnection(senderPeerId, { nickname: 'Participant' });
      }
      await peer.peerConnection.handleRemoteOffer(offer);
    });

    // WebRTC Signaling: Answer
    this.signaling.on('answer', async ({ senderPeerId, answer }) => {
      const peer = this.peers.get(senderPeerId);
      if (peer) {
        await peer.peerConnection.handleRemoteAnswer(answer);
      }
    });

    // WebRTC Signaling: ICE Candidate
    this.signaling.on('ice-candidate', async ({ senderPeerId, candidate }) => {
      const peer = this.peers.get(senderPeerId);
      if (peer) {
        await peer.peerConnection.handleRemoteCandidate(candidate);
      }
    });

    // Media State Updates (mute, camera, screen share)
    this.signaling.on('media-state', ({ senderPeerId, mediaState: state }) => {
      const peer = this.peers.get(senderPeerId);
      if (peer) {
        peer.mediaState = state;
      }

      this.videoGrid?.updatePeerMetadata(senderPeerId, {
        audioEnabled: state.audioEnabled,
        videoEnabled: state.videoEnabled,
        isScreenSharing: state.isScreenSharing
      });

      if (state.isScreenSharing) {
        const presenterName = peer?.nickname || 'Participant';
        toast.info(`${presenterName} is sharing their screen`);
      }
    });

    this.signaling.on('error', (err) => {
      toast.error('Signaling error: ' + (err.message || 'connection failed'));
    });

    this.signaling.connect().catch(() => {
      if (this.signalingMode === 'websocket') {
        toast.warning('WebSocket signaling server unavailable. Switching to BroadcastChannel mode.');
        this.signalingMode = 'broadcast';
        this.initSignaling();
      }
    });
  }

  /**
   * Set up a WebRTC PeerConnection for a specific remote participant in the mesh
   */
  setupPeerConnection(remotePeerId, remoteMetadata = {}) {
    if (this.peers.has(remotePeerId)) {
      return this.peers.get(remotePeerId);
    }

    const nickname = remoteMetadata?.nickname || 'Participant';

    // Perfect Negotiation: deterministic polite peer selection
    const isPolite = this.peerId < remotePeerId;
    this.logger.info(`Setting up PeerConnection with ${remotePeerId} (${nickname}). isPolite: ${isPolite}`);

    const peerConnection = new PeerConnectionEngine({
      targetPeerId: remotePeerId,
      isPolite
    });

    // Remote Audio Level Analyser for VAD speaking indicator
    const audioAnalyser = new AudioLevelAnalyser();
    audioAnalyser.on('speaking', (isSpeaking) => {
      const p = this.peers.get(remotePeerId);
      if (p) {
        p.isSpeaking = isSpeaking;
      }
      this.videoGrid?.updatePeerMetadata(remotePeerId, { isSpeaking });
    });

    // Wire up Signaling events targeted to this peer
    peerConnection.on('signal-offer', ({ targetPeerId, offer }) => {
      this.signaling?.sendOffer(targetPeerId, offer);
    });

    peerConnection.on('signal-answer', ({ targetPeerId, answer }) => {
      this.signaling?.sendAnswer(targetPeerId, answer);
    });

    peerConnection.on('signal-candidate', ({ targetPeerId, candidate }) => {
      this.signaling?.sendCandidate(targetPeerId, candidate);
    });

    // Remote Stream & Track Arrival
    peerConnection.on('remote-stream', (remoteStream) => {
      this.logger.info(`Attaching remote media stream from ${remotePeerId} to VideoGrid`);
      const p = this.peers.get(remotePeerId);
      if (p) {
        p.stream = remoteStream;
      }
      this.videoGrid?.updatePeerStream(remotePeerId, remoteStream);
      audioAnalyser.attachStream(remoteStream);
    });

    // Connection Lifecycle
    peerConnection.on('connection-state-change', (state) => {
      this.logger.info(`Peer ${remotePeerId} connection state: ${state}`);
      if (state === 'connected') {
        callState.setStatus(CallStatus.CONNECTED);
        sound.playConnect();
        toast.success('P2P WebRTC connection established!');
        this.callHeader?.setConnectionStatus('connected');
        statsCollector.start(1000);
      } else if (state === 'disconnected' || state === 'failed') {
        callState.setStatus(CallStatus.RECONNECTING);
        this.callHeader?.setConnectionStatus('reconnecting');
      }
    });

    // Attach local media track(s) to this peer connection
    // If currently screen sharing, attach the screen track for video and mic for audio
    if (mediaState.get().isScreenSharing && mediaDeviceService.screenStream) {
      const screenTrack = mediaDeviceService.screenStream.getVideoTracks()[0];
      const audioTrack = mediaDeviceService.localStream?.getAudioTracks()[0];
      if (screenTrack) peerConnection.pc.addTrack(screenTrack, mediaDeviceService.screenStream);
      if (audioTrack && mediaDeviceService.localStream) peerConnection.pc.addTrack(audioTrack, mediaDeviceService.localStream);
    } else if (mediaDeviceService.localStream) {
      peerConnection.setLocalStream(mediaDeviceService.localStream);
    }

    // Connect DataChannel for real-time chat with this peer
    this.dataChannelManager.addPeer(remotePeerId, peerConnection);

    // Polite peer initiates DataChannel creation
    if (isPolite) {
      peerConnection.createDataChannel('chat');
    }

    // Initialize WebRTC stats collector for this peer
    const statsCollector = new CallStatsCollector(peerConnection);
    statsCollector.on('stats', (metrics) => {
      callState.set({ stats: metrics });
      this.callHeader?.updateLatency(metrics.rttMs);
    });

    const peerData = {
      peerId: remotePeerId,
      nickname,
      peerConnection,
      statsCollector,
      audioAnalyser,
      stream: null,
      mediaState: {
        audioEnabled: remoteMetadata?.audioEnabled !== false,
        videoEnabled: remoteMetadata?.videoEnabled !== false,
        isScreenSharing: !!remoteMetadata?.isScreenSharing
      },
      isSpeaking: false
    };

    this.peers.set(remotePeerId, peerData);

    // Add peer to VideoGrid UI
    this.videoGrid?.addPeer(remotePeerId, {
      nickname,
      stream: null,
      audioEnabled: peerData.mediaState.audioEnabled,
      videoEnabled: peerData.mediaState.videoEnabled,
      isScreenSharing: peerData.mediaState.isScreenSharing
    });

    return peerData;
  }

  cleanupPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.statsCollector?.stop();
    peer.audioAnalyser?.detach();
    peer.peerConnection?.close();
    this.dataChannelManager.removePeer(peerId);
    this.peers.delete(peerId);

    this.videoGrid?.removePeer(peerId);
  }

  cleanupAllPeers() {
    for (const peerId of Array.from(this.peers.keys())) {
      this.cleanupPeer(peerId);
    }
    this.peers.clear();
  }

  renderCallStage() {
    this.lobbyContainer.style.display = 'none';
    this.callContainer.style.display = 'flex';
    this.callContainer.style.flexDirection = 'column';
    this.callContainer.innerHTML = '';

    // Render Call Header
    this.callHeader = new CallHeader({
      onLeave: () => this.handleHangup()
    });
    this.navContainer.innerHTML = '';
    this.navContainer.appendChild(this.callHeader.render());
    this.callHeader.setRoomId(this.roomId);
    this.callHeader.updateParticipantCount(this.peers.size + 1);

    // Call duration timer subscription
    callState.on('change', (curr) => {
      this.callHeader?.updateDuration(curr.callDurationSec);
    });

    // Render Google Meet Video Grid Component
    this.videoGrid = new VideoGrid();
    this.callContainer.appendChild(this.videoGrid.render());

    // Attach local stream to Video Grid
    if (mediaDeviceService.localStream) {
      this.videoGrid.setLocalStream(mediaDeviceService.localStream, mediaState.get().isScreenSharing);
    }
    this.videoGrid.updateLocalState({
      ...mediaState.get(),
      nickname: this.nickname
    });

    // Render Floating Call Controls Dock
    this.callControls = new CallControls({
      onToggleAudio: () => this.handleToggleAudio(),
      onToggleVideo: () => this.handleToggleVideo(),
      onToggleScreenShare: () => this.handleToggleScreenShare(),
      onToggleChat: () => {
        this.chatDrawer?.toggle();
      },
      onOpenStats: () => {
        // Collect stats from first connected peer or active presenter
        const firstPeer = Array.from(this.peers.values())[0];
        if (firstPeer && firstPeer.statsCollector) {
          this.statsModal.show(firstPeer.statsCollector);
        } else {
          toast.info('Diagnostic stats will be available once peer connects');
        }
      },
      onOpenSettings: () => this.handleOpenSettings(),
      onHangup: () => this.handleHangup()
    });
    this.callContainer.appendChild(this.callControls.render());

    // Sync media state to controls
    this.callControls.updateMediaState(mediaState.get());
  }

  handleToggleAudio() {
    const enabled = mediaState.toggleAudio();
    if (mediaDeviceService.localStream) {
      mediaDeviceService.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }

    sound.playMute(!enabled);
    this.callControls?.updateMediaState(mediaState.get());
    this.lobby?.updateMediaState(mediaState.get());
    this.videoGrid?.updateLocalState(mediaState.get());

    // Broadcast audio state change to all peers in room
    this.signaling?.sendMediaState(enabled, mediaState.get().videoEnabled, mediaState.get().isScreenSharing);
  }

  handleToggleVideo() {
    const enabled = mediaState.toggleVideo();
    if (mediaDeviceService.localStream) {
      mediaDeviceService.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }

    this.callControls?.updateMediaState(mediaState.get());
    this.lobby?.updateMediaState(mediaState.get());
    this.videoGrid?.updateLocalState(mediaState.get());

    // Broadcast video state change to all peers in room
    this.signaling?.sendMediaState(mediaState.get().audioEnabled, enabled, mediaState.get().isScreenSharing);
  }

  async handleToggleScreenShare() {
    const isCurrentlySharing = mediaState.get().isScreenSharing;

    if (!isCurrentlySharing) {
      try {
        const screenStream = await mediaDeviceService.getScreenStream();
        if (!screenStream) return;

        const screenTrack = screenStream.getVideoTracks()[0];
        mediaState.setScreenSharing(true);

        // Replace video track on ALL connected WebRTC PeerConnections
        for (const [id, peer] of this.peers.entries()) {
          try {
            await peer.peerConnection.replaceTrack('video', screenTrack);
          } catch (err) {
            this.logger.warn(`Failed to replace video track for peer ${id}:`, err);
          }
        }

        // Update local tile display and auto-pin local screen share in spotlight
        this.videoGrid?.setLocalStream(screenStream, true);
        this.callControls?.updateMediaState(mediaState.get());

        // Broadcast to all participants that we started screen sharing
        this.signaling?.sendMediaState(mediaState.get().audioEnabled, mediaState.get().videoEnabled, true);

        // When user stops screen sharing from browser native toolbar
        screenTrack.onended = async () => {
          await this.revertFromScreenShare();
        };

        toast.info('Screen sharing active — Pinned to stage');
      } catch (err) {
        toast.error('Screen share error: ' + err.message);
      }
    } else {
      await this.revertFromScreenShare();
    }
  }

  async revertFromScreenShare() {
    mediaState.setScreenSharing(false);
    if (mediaDeviceService.screenStream) {
      mediaDeviceService.screenStream.getTracks().forEach(t => t.stop());
      mediaDeviceService.screenStream = null;
    }

    // Swap back to camera track (or null if no camera) on ALL connected PeerConnections
    const camTrack = mediaDeviceService.localStream?.getVideoTracks()[0];
    for (const [id, peer] of this.peers.entries()) {
      try {
        if (camTrack) {
          await peer.peerConnection.replaceTrack('video', camTrack);
        } else {
          await peer.peerConnection.replaceTrack('video', null);
        }
      } catch (err) {
        this.logger.warn(`Failed to restore camera track for peer ${id}:`, err);
      }
    }

    // Revert local tile and unpin local user
    if (mediaDeviceService.localStream) {
      this.videoGrid?.setLocalStream(mediaDeviceService.localStream, false);
    } else {
      this.videoGrid?.setLocalStream(null, false);
    }

    this.callControls?.updateMediaState(mediaState.get());

    // Broadcast screen share ended to all peers in room
    this.signaling?.sendMediaState(mediaState.get().audioEnabled, mediaState.get().videoEnabled, false);

    if (camTrack && mediaState.get().videoEnabled) {
      toast.info('Switched back to camera');
    } else {
      toast.info('Screen sharing ended');
    }
  }

  handleOpenSettings() {
    openDeviceSettingsModal(async (kind, deviceId) => {
      try {
        if (kind === 'audio') {
          const newTrack = await mediaDeviceService.switchAudioDevice(deviceId);
          if (newTrack) {
            for (const [id, peer] of this.peers.entries()) {
              await peer.peerConnection.replaceTrack('audio', newTrack);
            }
          }
          if (mediaDeviceService.localStream) {
            this.localAudioAnalyser.attachStream(mediaDeviceService.localStream);
          }
        } else if (kind === 'video') {
          const newTrack = await mediaDeviceService.switchVideoDevice(deviceId);
          if (newTrack) {
            // Only swap track if not currently screen sharing
            if (!mediaState.get().isScreenSharing) {
              for (const [id, peer] of this.peers.entries()) {
                await peer.peerConnection.replaceTrack('video', newTrack);
              }
              if (mediaDeviceService.localStream) {
                this.videoGrid?.setLocalStream(mediaDeviceService.localStream, false);
              }
            }
            if (mediaDeviceService.localStream) {
              this.lobby?.setPreviewStream(mediaDeviceService.localStream);
            }
          }
        }
      } catch (err) {
        toast.error(`Failed to switch ${kind} device`);
      }
    });
  }

  handleHangup() {
    sound.playHangup();
    toast.info('Call ended');

    // Revert screen share if active
    if (mediaState.get().isScreenSharing) {
      mediaState.setScreenSharing(false);
      if (mediaDeviceService.screenStream) {
        mediaDeviceService.screenStream.getTracks().forEach(t => t.stop());
        mediaDeviceService.screenStream = null;
      }
    }

    this.cleanupAllPeers();

    if (this.signaling) {
      this.signaling.disconnect();
      this.signaling = null;
    }

    callState.setStatus(CallStatus.LOBBY);

    // Return to Lobby UI
    this.callContainer.style.display = 'none';
    this.callContainer.innerHTML = '';
    this.navContainer.innerHTML = '';
    this.lobbyContainer.style.display = 'flex';
    this.chatDrawer?.toggle(false);

    // Reattach camera preview to lobby
    if (mediaDeviceService.localStream) {
      this.lobby?.setPreviewStream(mediaDeviceService.localStream);
      this.localAudioAnalyser.attachStream(mediaDeviceService.localStream);
    }
  }
}
