/**
 * Google Meet Style Multi-Participant Video Stage & Grid Component.
 * Supports:
 * - Dynamic adaptive multi-participant grid (1 to N participants)
 * - Cinema / Spotlight mode with pinned center stage and filmstrip sidebar
 * - Auto-pinning on screen share (for local presenter or remote presenters)
 * - Manual pin / unpin for any participant tile
 * - Avatar placeholder with initial when camera is turned off
 * - Active speaker pulse glow (VAD indicator)
 * - Mic muted badges and presenting badges
 * - Fullscreen per video tile
 */

import { icons } from '../../../shared/ui/icons.js';
import { toast } from '../../../shared/ui/toast.js';

export class VideoGrid {
  constructor({ onPinChange } = {}) {
    this.onPinChange = onPinChange;
    this.container = null;

    // Local participant state
    this.localParticipant = {
      id: 'local',
      nickname: 'You',
      stream: null,
      audioEnabled: true,
      videoEnabled: true,
      isSpeaking: false,
      isScreenSharing: false
    };

    // Map of remotePeerId -> Participant state
    this.remoteParticipants = new Map();

    // Currently pinned participant ID ('local' or remotePeerId or null for grid)
    this.pinnedPeerId = null;
    this.autoPinnedForScreenShare = null;

    // Cache of persistent DOM tile elements: id -> HTMLElement
    this.tileElements = new Map();
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'video-stage';

    this.updateLayout();
    return this.container;
  }

  /**
   * Set local camera or screen stream
   */
  setLocalStream(stream, isScreenSharing = false) {
    this.localParticipant.stream = stream;
    this.localParticipant.isScreenSharing = isScreenSharing;

    // Auto-pin local user if they started screen sharing
    if (isScreenSharing) {
      this.pinnedPeerId = 'local';
      this.autoPinnedForScreenShare = 'local';
    } else if (this.pinnedPeerId === 'local' && this.autoPinnedForScreenShare === 'local') {
      this.pinnedPeerId = null;
      this.autoPinnedForScreenShare = null;
    }

    this.updateParticipantTile('local');
    this.updateLayout();
  }

  /**
   * Update local user state (mic, cam, speaking, nickname)
   */
  updateLocalState(updates = {}) {
    Object.assign(this.localParticipant, updates);
    this.updateParticipantTile('local');
  }

  /**
   * Add a new remote peer to the room grid
   */
  addPeer(peerId, { nickname = 'Participant', stream = null, audioEnabled = true, videoEnabled = true, isScreenSharing = false } = {}) {
    this.remoteParticipants.set(peerId, {
      id: peerId,
      nickname,
      stream,
      audioEnabled,
      videoEnabled,
      isSpeaking: false,
      isScreenSharing
    });

    if (isScreenSharing) {
      this.pinnedPeerId = peerId;
      this.autoPinnedForScreenShare = peerId;
    }

    this.updateLayout();
  }

  /**
   * Set remote stream (supports original setRemoteStream signature as well as peerId)
   */
  setRemoteStream(stream, peerId = null) {
    const targetPeerId = peerId || Array.from(this.remoteParticipants.keys())[0] || 'remote-peer';
    this.updatePeerStream(targetPeerId, stream);
  }

  /**
   * Update stream for an existing remote peer
   */
  updatePeerStream(peerId, stream) {
    const peer = this.remoteParticipants.get(peerId);
    if (peer) {
      peer.stream = stream;
      this.updateParticipantTile(peerId);
    } else {
      this.addPeer(peerId, { stream });
    }
  }

  /**
   * Update remote peer metadata (supports original signature as well as peerId)
   */
  updatePeerMetadata(peerIdOrData, maybeUpdates = {}) {
    let peerId, updates;
    if (typeof peerIdOrData === 'string') {
      peerId = peerIdOrData;
      updates = maybeUpdates || {};
    } else {
      peerId = Array.from(this.remoteParticipants.keys())[0] || 'remote-peer';
      updates = peerIdOrData || {};
      if (updates.remoteNickname !== undefined) updates.nickname = updates.remoteNickname;
      if (updates.remoteAudioEnabled !== undefined) updates.audioEnabled = updates.remoteAudioEnabled;
      if (updates.remoteVideoEnabled !== undefined) updates.videoEnabled = updates.remoteVideoEnabled;
      if (updates.isRemoteSpeaking !== undefined) updates.isSpeaking = updates.isRemoteSpeaking;
    }

    const peer = this.remoteParticipants.get(peerId);
    if (!peer) return;

    const wasScreenSharing = peer.isScreenSharing;
    Object.assign(peer, updates);

    // Auto-pin if peer started sharing screen
    if (!wasScreenSharing && peer.isScreenSharing) {
      this.pinnedPeerId = peerId;
      this.autoPinnedForScreenShare = peerId;
      this.updateLayout();
      return;
    }

    // Auto-unpin if peer stopped sharing screen and was auto-pinned
    if (wasScreenSharing && !peer.isScreenSharing && this.pinnedPeerId === peerId && this.autoPinnedForScreenShare === peerId) {
      this.pinnedPeerId = null;
      this.autoPinnedForScreenShare = null;
      this.updateLayout();
      return;
    }

    this.updateParticipantTile(peerId);
  }

  /**
   * Remove remote peer when they disconnect
   */
  removePeer(peerId) {
    this.remoteParticipants.delete(peerId);
    const el = this.tileElements.get(peerId);
    if (el) {
      el.remove();
      this.tileElements.delete(peerId);
    }

    if (this.pinnedPeerId === peerId) {
      this.pinnedPeerId = null;
      this.autoPinnedForScreenShare = null;
    }

    this.updateLayout();
  }

  /**
   * Manually pin a participant to the center stage
   */
  pinParticipant(peerId) {
    if (this.pinnedPeerId === peerId) {
      // Toggle off if already pinned
      this.pinnedPeerId = null;
      this.autoPinnedForScreenShare = null;
    } else {
      this.pinnedPeerId = peerId;
    }

    this.onPinChange?.(this.pinnedPeerId);
    this.updateLayout();
  }

  /**
   * Unpin participant and return to adaptive grid
   */
  unpinParticipant() {
    this.pinnedPeerId = null;
    this.autoPinnedForScreenShare = null;
    this.onPinChange?.(null);
    this.updateLayout();
  }

  getPinnedPeerId() {
    return this.pinnedPeerId;
  }

  getPeerCount() {
    return this.remoteParticipants.size + 1; // including local
  }

  /**
   * Get all participants in a unified array
   */
  getAllParticipants() {
    return [this.localParticipant, ...Array.from(this.remoteParticipants.values())];
  }

  /**
   * Create or retrieve existing persistent tile element for a participant
   */
  getOrCreateTile(participant, isFilmstrip = false) {
    const tileKey = `${participant.id}_${isFilmstrip ? 'film' : 'main'}`;
    let tile = this.tileElements.get(tileKey);

    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'participant-tile';
      tile.dataset.peerId = participant.id;

      const isLocal = participant.id === 'local';

      tile.innerHTML = `
        <video class="video-element" autoplay playsinline ${isLocal ? 'muted' : ''}></video>

        <!-- Placeholder when video is disabled -->
        <div class="video-placeholder" style="display: none;">
          <div class="avatar-circle">
            <span class="avatar-initial">?</span>
          </div>
          <span class="placeholder-name" style="font-size: 13px; color: var(--text-muted); font-weight: 500;"></span>
        </div>

        <!-- Bottom Pill Overlay -->
        <div class="tile-info-pill">
          <span class="tile-name-label">User</span>
          <span class="tile-mic-badge badge badge-danger" style="display: none; padding: 2px 5px; font-size: 10px;">
            ${icons.micOff('', 10)} Muted
          </span>
          <span class="tile-presenting-badge badge badge-primary" style="display: none; padding: 2px 6px; font-size: 10px;">
            ${icons.screenShare('', 10)} Presenting
          </span>
        </div>

        <!-- Top Right Action Controls -->
        <div class="tile-actions">
          <button class="btn-tile-action btn-tile-pin" title="Pin to center stage">
            ${icons.pin('', 14)}
          </button>
          <button class="btn-tile-action btn-tile-fs" title="Toggle Fullscreen">
            ${icons.maximize('', 14)}
          </button>
        </div>
      `;

      // Event listeners
      const pinBtn = tile.querySelector('.btn-tile-pin');
      pinBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pinParticipant(participant.id);
      });

      const fsBtn = tile.querySelector('.btn-tile-fs');
      fsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          tile.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });

      // Clicking a filmstrip tile pins that participant
      if (isFilmstrip) {
        tile.addEventListener('click', () => {
          this.pinParticipant(participant.id);
        });
      }

      this.tileElements.set(tileKey, tile);
    }

    this.populateTile(tile, participant, isFilmstrip);
    return tile;
  }

  /**
   * Populate and update properties on a tile element
   */
  populateTile(tile, participant, isFilmstrip = false) {
    const isLocal = participant.id === 'local';
    const video = tile.querySelector('video');
    const placeholder = tile.querySelector('.video-placeholder');
    const initialEl = tile.querySelector('.avatar-initial');
    const placeholderName = tile.querySelector('.placeholder-name');
    const nameLabel = tile.querySelector('.tile-name-label');
    const micBadge = tile.querySelector('.tile-mic-badge');
    const presentingBadge = tile.querySelector('.tile-presenting-badge');
    const pinBtn = tile.querySelector('.btn-tile-pin');
    const isPinned = this.pinnedPeerId === participant.id;

    // Nickname display
    const displayName = isLocal ? (participant.nickname ? `${participant.nickname} (You)` : 'You') : (participant.nickname || 'Participant');
    if (nameLabel) nameLabel.textContent = displayName;
    if (placeholderName) placeholderName.textContent = displayName;

    const initial = (participant.nickname || (isLocal ? 'You' : 'P')).charAt(0).toUpperCase();
    if (initialEl) initialEl.textContent = initial;

    // Video stream binding
    if (video) {
      if (participant.stream && video.srcObject !== participant.stream) {
        video.srcObject = participant.stream;
        video.play().catch(() => {});
      }

      // Mirroring: Mirror local webcam, but NEVER mirror screen share or remote video
      if (isLocal && !participant.isScreenSharing) {
        video.classList.add('mirrored');
      } else {
        video.classList.remove('mirrored');
      }

      // Screen share styling (contain aspect ratio)
      if (participant.isScreenSharing) {
        video.classList.add('screen-share');
      } else {
        video.classList.remove('screen-share');
      }
    }

    // Video placeholder toggle:
    // If the participant is sharing their screen, screen video MUST be shown even if webcam/video is turned off!
    const hasVideoTracks = participant.stream && participant.stream.getVideoTracks().length > 0;
    const isScreenActive = Boolean(participant.isScreenSharing && hasVideoTracks);
    const isCameraActive = Boolean(participant.videoEnabled !== false && hasVideoTracks);
    const isVideoActive = isScreenActive || isCameraActive;

    if (placeholder) {
      placeholder.style.display = isVideoActive ? 'none' : 'flex';
    }

    // Mic mute indicator
    if (micBadge) {
      micBadge.style.display = participant.audioEnabled === false ? 'inline-flex' : 'none';
    }

    // Presenting badge
    if (presentingBadge) {
      presentingBadge.style.display = participant.isScreenSharing ? 'inline-flex' : 'none';
    }

    // Speaking active ring
    if (participant.isSpeaking) {
      tile.classList.add('speaking');
      tile.querySelector('.avatar-circle')?.classList.add('speaking');
    } else {
      tile.classList.remove('speaking');
      tile.querySelector('.avatar-circle')?.classList.remove('speaking');
    }

    // Pin button icon and title
    if (pinBtn) {
      if (isPinned && !isFilmstrip) {
        pinBtn.innerHTML = icons.pinOff('', 14);
        pinBtn.title = 'Unpin from center stage';
        pinBtn.classList.add('active');
      } else {
        pinBtn.innerHTML = icons.pin('', 14);
        pinBtn.title = 'Pin to center stage';
        pinBtn.classList.remove('active');
      }
    }
  }

  /**
   * Update participant tile in place without layout rebuild
   */
  updateParticipantTile(participantId) {
    const participant = participantId === 'local' 
      ? this.localParticipant 
      : this.remoteParticipants.get(participantId);

    if (!participant) return;

    const mainTile = this.tileElements.get(`${participant.id}_main`);
    if (mainTile) {
      this.populateTile(mainTile, participant, false);
    }

    const filmTile = this.tileElements.get(`${participant.id}_film`);
    if (filmTile) {
      this.populateTile(filmTile, participant, true);
    }
  }

  /**
   * Re-evaluate and re-render the layout based on current state
   */
  updateLayout() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const allParticipants = this.getAllParticipants();
    const isSpotlightMode = this.pinnedPeerId !== null;

    if (isSpotlightMode) {
      this.renderSpotlightLayout(allParticipants);
    } else {
      this.renderGridLayout(allParticipants);
    }
  }

  /**
   * Renders Google Meet Adaptive Multi-User Grid
   */
  renderGridLayout(participants) {
    const gridWrap = document.createElement('div');
    gridWrap.className = 'video-grid-container';
    gridWrap.dataset.count = Math.min(participants.length, 12);

    for (const p of participants) {
      const tile = this.getOrCreateTile(p, false);
      gridWrap.appendChild(tile);
    }

    this.container.appendChild(gridWrap);

    // If only local user is in the room, render an elegant invitation prompt
    if (participants.length === 1) {
      const prompt = document.createElement('div');
      prompt.className = 'empty-room-prompt';
      prompt.innerHTML = `
        <div class="empty-room-card">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-info">${icons.users('', 13)} Ready</span>
            <span style="font-weight: 600; font-size: 13.5px;">You are the only person in this call</span>
          </div>
          <span style="font-size: 12px; color: var(--text-secondary);">
            Share the room code or invite link so others can join you.
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-empty-copy" style="align-self: flex-start; padding: 4px 10px; font-size: 12px; margin-top: 4px;">
            ${icons.copy('', 12)} Copy Invite Link
          </button>
        </div>
      `;

      prompt.querySelector('#btn-empty-copy')?.addEventListener('click', () => {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
          toast.success('Room link copied to clipboard!');
        }).catch(() => {
          toast.info(window.location.href);
        });
      });

      this.container.appendChild(prompt);
    }
  }

  /**
   * Renders Google Meet Spotlight / Cinema Mode (Center stage + Filmstrip sidebar)
   */
  renderSpotlightLayout(participants) {
    const layout = document.createElement('div');
    layout.className = 'spotlight-layout';

    // Find pinned participant
    const pinned = participants.find(p => p.id === this.pinnedPeerId) || this.localParticipant;
    const others = participants.filter(p => p.id !== pinned.id);

    // Main Center Stage
    const stageCol = document.createElement('div');
    stageCol.className = 'spotlight-main';

    // Presenter Banner if screen sharing
    if (pinned.isScreenSharing) {
      const banner = document.createElement('div');
      banner.className = 'presenting-banner';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          ${icons.screenShare('', 16)}
          <span style="font-weight: 600; font-size: 13px;">
            ${pinned.id === 'local' ? 'You are presenting your screen to everyone' : `${pinned.nickname} is presenting`}
          </span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-spotlight-unpin" style="padding: 4px 10px; font-size: 12px;">
          ${icons.pinOff('', 12)} Unpin
        </button>
      `;

      banner.querySelector('#btn-spotlight-unpin')?.addEventListener('click', () => {
        this.unpinParticipant();
      });

      stageCol.appendChild(banner);
    }

    const mainTile = this.getOrCreateTile(pinned, false);
    stageCol.appendChild(mainTile);
    layout.appendChild(stageCol);

    // Filmstrip Sidebar with other participants
    if (others.length > 0) {
      const filmstrip = document.createElement('div');
      filmstrip.className = 'filmstrip-sidebar';

      const filmstripTitle = document.createElement('div');
      filmstripTitle.className = 'filmstrip-header';
      filmstripTitle.innerHTML = `
        <span>${icons.users('', 13)} Participants (${participants.length})</span>
      `;
      filmstrip.appendChild(filmstripTitle);

      const filmstripList = document.createElement('div');
      filmstripList.className = 'filmstrip-list';

      for (const other of others) {
        const itemWrap = document.createElement('div');
        itemWrap.className = 'filmstrip-item-wrap';
        const filmTile = this.getOrCreateTile(other, true);
        itemWrap.appendChild(filmTile);
        filmstripList.appendChild(itemWrap);
      }

      filmstrip.appendChild(filmstripList);
      layout.appendChild(filmstrip);
    }

    this.container.appendChild(layout);
  }
}
