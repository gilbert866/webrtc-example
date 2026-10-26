/**
 * Main Application Orchestrator.
 * Wires together feature modules (Media, Signaling, Call Engine, Chat, Diagnostics, Room Lobby).
 */

import { Logger } from '../shared/utils/logger.js';
import { generatePeerId, generateRoomId } from '../shared/utils/id.js';
import { sound } from '../shared/utils/sound.js';
import { toast } from '../shared/ui/toast.js';

import { mediaDeviceService, mediaState, AudioLevelAnalyser, openDeviceSettingsModal } from '../features/media/index.js';
import { WebSocketSignalingClient, BroadcastSignalingClient } from '../features/signaling/index.js';
import { PeerConnectionEngine, callState, CallStatus, CallStatsCollector, VideoGrid, CallControls, CallHeader, IncomingCallModal } from '../features/call/index.js';
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
    this.peerConnection = null;
    this.statsCollector = null;
    this.dataChannelManager = null;

    // Audio level detectors
    this.localAudioAnalyser = new AudioLevelAnalyser();
    this.remoteAudioAnalyser = new AudioLevelAnalyser();

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

    this.remoteAudioAnalyser.on('speaking', (isSpeaking) => {
      callState.set({ isRemoteSpeaking: isSpeaking });
      this.videoGrid?.updatePeerMetadata({
        ...callState.get(),
        isRemoteSpeaking: isSpeaking
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

    // Update URL history without page reload so room link can be easily bookmarked/shared
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

    this.signaling.on('joined', ({ existingPeers }) => {
      this.logger.info(`Joined room "${this.roomId}". Existing participants: ${existingPeers.length}`);
      toast.info(`Joined room "${this.roomId}". Waiting for peer...`);

      // If a peer already exists in the room, initiate connection
      if (existingPeers.length > 0) {
        const remotePeer = existingPeers[0];
        this.setupPeerConnection(remotePeer.peerId, remotePeer.metadata);
      }
    });

    this.signaling.on('peer-joined', ({ peerId, metadata }) => {
      toast.success(`${metadata?.nickname || 'Peer'} joined the room`);
      sound.playConnect();
      this.setupPeerConnection(peerId, metadata);
    });

    this.signaling.on('peer-left', ({ peerId }) => {
      toast.info('Remote participant left the call');
      sound.playHangup();
      this.cleanupPeerConnection();
      callState.setStatus(CallStatus.LOBBY);
    });

    this.signaling.on('offer', async ({ senderPeerId, offer }) => {
      if (!this.peerConnection) {
        this.setupPeerConnection(senderPeerId, { nickname: 'Remote Peer' });
      }
      await this.peerConnection.handleRemoteOffer(offer);
    });

    this.signaling.on('answer', async ({ senderPeerId, answer }) => {
      if (this.peerConnection) {
        await this.peerConnection.handleRemoteAnswer(answer);
      }
    });

    this.signaling.on('ice-candidate', async ({ senderPeerId, candidate }) => {
      if (this.peerConnection) {
        await this.peerConnection.handleRemoteCandidate(candidate);
      }
    });

    this.signaling.on('media-state', ({ senderPeerId, mediaState: state }) => {
      callState.set({
        remoteAudioEnabled: state.audioEnabled,
        remoteVideoEnabled: state.videoEnabled
      });
      this.videoGrid?.updatePeerMetadata({
        remoteAudioEnabled: state.audioEnabled,
        remoteVideoEnabled: state.videoEnabled
      });
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

  setupPeerConnection(remotePeerId, remoteMetadata = {}) {
    if (this.peerConnection) {
      this.cleanupPeerConnection();
    }

    callState.set({
      remotePeerId,
      remoteNickname: remoteMetadata.nickname || 'Remote Peer'
    });

    // Perfect Negotiation: deterministic polite peer selection
    const isPolite = this.peerId < remotePeerId;
    this.logger.info(`Creating PeerConnection with ${remotePeerId}. isPolite: ${isPolite}`);

    this.peerConnection = new PeerConnectionEngine({
      targetPeerId: remotePeerId,
      isPolite
    });

    // Wire up Signaling events
    this.peerConnection.on('signal-offer', ({ targetPeerId, offer }) => {
      this.signaling?.sendOffer(targetPeerId, offer);
    });

    this.peerConnection.on('signal-answer', ({ targetPeerId, answer }) => {
      this.signaling?.sendAnswer(targetPeerId, answer);
    });

    this.peerConnection.on('signal-candidate', ({ targetPeerId, candidate }) => {
      this.signaling?.sendCandidate(targetPeerId, candidate);
    });

    // Remote Stream & Track Arrival
    this.peerConnection.on('remote-stream', (remoteStream) => {
      this.logger.info('Attaching remote media stream to VideoGrid');
      this.videoGrid?.setRemoteStream(remoteStream);
      this.remoteAudioAnalyser.attachStream(remoteStream);
    });

    // Connection Lifecycle
    this.peerConnection.on('connection-state-change', (state) => {
      if (state === 'connected') {
        callState.setStatus(CallStatus.CONNECTED);
        sound.playConnect();
        toast.success('P2P WebRTC connection established!');
        this.callHeader?.setConnectionStatus('connected');
        this.statsCollector?.start(1000);
      } else if (state === 'disconnected' || state === 'failed') {
        callState.setStatus(CallStatus.RECONNECTING);
        this.callHeader?.setConnectionStatus('reconnecting');
      }
    });

    // Attach local stream
    if (mediaDeviceService.localStream) {
      this.peerConnection.setLocalStream(mediaDeviceService.localStream);
    }

    // Setup DataChannel for real-time text chat
    this.dataChannelManager = new DataChannelManager(this.peerConnection);
    this.dataChannelManager.on('message', (msg) => {
      this.chatDrawer?.appendMessage(msg);
      if (!this.chatDrawer?.isOpen) {
        const count = callState.get().unreadMessagesCount + 1;
        callState.set({ unreadMessagesCount: count });
        this.callControls?.updateUnreadCount(count);
      }
    });

    // Initiate DataChannel if polite/offerer
    if (isPolite) {
      this.peerConnection.createDataChannel('chat');
    }

    // Initialize WebRTC stats collector
    this.statsCollector = new CallStatsCollector(this.peerConnection);
    this.statsCollector.on('stats', (metrics) => {
      callState.set({ stats: metrics });
      this.callHeader?.updateLatency(metrics.rttMs);
    });
  }

  cleanupPeerConnection() {
    this.statsCollector?.stop();
    this.statsCollector = null;
    this.localAudioAnalyser.detach();
    this.remoteAudioAnalyser.detach();

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
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

    // Call duration timer subscription
    callState.on('change', (curr) => {
      this.callHeader?.updateDuration(curr.callDurationSec);
    });

    // Render Video Grid
    this.videoGrid = new VideoGrid({});
    this.callContainer.appendChild(this.videoGrid.render());

    // Attach local stream to PiP video view
    if (mediaDeviceService.localStream) {
      this.videoGrid.setLocalStream(mediaDeviceService.localStream);
    }
    this.videoGrid.updatePeerMetadata({
      remoteNickname: callState.get().remoteNickname
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
        this.statsModal.show(this.statsCollector);
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

    // Notify remote peer
    this.signaling?.sendMediaState(enabled, mediaState.get().videoEnabled);
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

    // Notify remote peer
    this.signaling?.sendMediaState(mediaState.get().audioEnabled, enabled);
  }

  async handleToggleScreenShare() {
    const isCurrentlySharing = mediaState.get().isScreenSharing;

    if (!isCurrentlySharing) {
      try {
        const screenStream = await mediaDeviceService.getScreenStream();
        if (!screenStream) return;

        const screenTrack = screenStream.getVideoTracks()[0];
        mediaState.setScreenSharing(true);

        // Replace video track on WebRTC PeerConnection RTCRtpSender
        if (this.peerConnection) {
          await this.peerConnection.replaceTrack('video', screenTrack);
        }

        // Update local PiP display
        this.videoGrid?.setLocalStream(screenStream);
        this.callControls?.updateMediaState(mediaState.get());

        // When user stops screen sharing from browser toolbar
        screenTrack.onended = async () => {
          this.revertFromScreenShare();
        };

        toast.info('Screen sharing active');
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

    // Swap back to camera track
    const camTrack = mediaDeviceService.localStream?.getVideoTracks()[0];
    if (this.peerConnection && camTrack) {
      await this.peerConnection.replaceTrack('video', camTrack);
    }

    if (mediaDeviceService.localStream) {
      this.videoGrid?.setLocalStream(mediaDeviceService.localStream);
    }

    this.callControls?.updateMediaState(mediaState.get());
    toast.info('Switched back to camera');
  }

  handleOpenSettings() {
    openDeviceSettingsModal(async (kind, deviceId) => {
      try {
        if (kind === 'audio') {
          const newTrack = await mediaDeviceService.switchAudioDevice(deviceId);
          if (this.peerConnection && newTrack) {
            await this.peerConnection.replaceTrack('audio', newTrack);
          }
          if (mediaDeviceService.localStream) {
            this.localAudioAnalyser.attachStream(mediaDeviceService.localStream);
          }
        } else if (kind === 'video') {
          const newTrack = await mediaDeviceService.switchVideoDevice(deviceId);
          if (this.peerConnection && newTrack) {
            await this.peerConnection.replaceTrack('video', newTrack);
          }
          if (mediaDeviceService.localStream) {
            this.videoGrid?.setLocalStream(mediaDeviceService.localStream);
            this.lobby?.setPreviewStream(mediaDeviceService.localStream);
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

    this.cleanupPeerConnection();

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
