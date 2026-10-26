/**
 * Room Lobby Component.
 * Pre-call green room allowing users to check camera/mic, choose nickname,
 * select signaling mode, and generate or join room sessions.
 */

import { icons } from '../../../shared/ui/icons.js';
import { mediaState } from '../../media/state/media-state.js';

export class RoomLobby {
  constructor({
    initialRoomId,
    initialNickname,
    onJoinRoom,
    onToggleAudio,
    onToggleVideo,
    onOpenSettings,
    onModeChange
  }) {
    this.initialRoomId = initialRoomId || '';
    this.initialNickname = initialNickname || 'User';
    this.handlers = {
      onJoinRoom,
      onToggleAudio,
      onToggleVideo,
      onOpenSettings,
      onModeChange
    };
    this.element = null;
    this.previewVideo = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'lobby-stage';

    this.element.innerHTML = `
      <div class="lobby-card">
        <!-- Preview Column -->
        <div class="lobby-preview-col">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary); display:flex; align-items:center; gap:6px;">
              ${icons.video('', 15)} Camera Preview
            </span>
            <div class="badge badge-success">
              <span class="badge-dot pulse"></span> Ready
            </div>
          </div>

          <div class="lobby-preview-box">
            <video id="lobby-preview-video" class="video-element mirrored" autoplay playsinline muted></video>
            <div class="video-placeholder" id="lobby-preview-placeholder" style="display: none;">
              <div class="avatar-circle">
                <span id="lobby-avatar-initial">U</span>
              </div>
              <span style="color: var(--text-muted); font-size: 13px;">Camera is turned off</span>
            </div>
          </div>

          <!-- Mic Volume Test Meter -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted);">
              <span>Microphone Activity</span>
              <span id="lobby-mic-status">Detecting...</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden;">
              <div id="lobby-mic-level" style="height: 100%; width: 0%; background: var(--color-success); transition: width 0.05s ease;"></div>
            </div>
          </div>

          <!-- Quick Media Toggles -->
          <div class="lobby-controls">
            <button class="btn-icon" id="lobby-btn-mic" title="Toggle Mic" aria-label="Toggle Mic">
              <span id="lobby-mic-icon">${icons.mic('', 18)}</span>
            </button>
            <button class="btn-icon" id="lobby-btn-cam" title="Toggle Camera" aria-label="Toggle Camera">
              <span id="lobby-cam-icon">${icons.video('', 18)}</span>
            </button>
            <button class="btn-icon" id="lobby-btn-settings" title="Audio/Video Settings" aria-label="Settings">
              ${icons.settings('', 18)}
            </button>
          </div>
        </div>

        <!-- Form Column -->
        <div class="lobby-form-col">
          <div class="badge badge-info" style="align-self: flex-start; margin-bottom: 12px;">
            ${icons.sparkles('', 12)} WebRTC Enterprise Grade
          </div>
          <h1 class="lobby-title">Instant Audio & Video Calling</h1>
          <p class="lobby-desc">
            Direct peer-to-peer encrypted communication powered by WebRTC with automated Perfect Negotiation and acoustic optimization.
          </p>

          <form id="lobby-join-form">
            <div class="input-group">
              <label class="input-label" for="input-nickname">Your Display Name</label>
              <input 
                type="text" 
                id="input-nickname" 
                class="input-text" 
                placeholder="e.g. Alex" 
                value="${this.initialNickname}" 
                required 
              />
            </div>

            <div class="input-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2px;">
                <label class="input-label" for="input-room-id" style="margin: 0;">Room Code</label>
                <button type="button" id="btn-generate-room" style="font-size: 12px; color: var(--color-primary); cursor: pointer;">
                  Generate New
                </button>
              </div>
              <input 
                type="text" 
                id="input-room-id" 
                class="input-text" 
                placeholder="e.g. swift-nexus-482" 
                value="${this.initialRoomId}" 
                style="font-family: var(--font-mono); font-weight: 600;" 
                required 
              />
            </div>

            <!-- Signaling Mode Selector -->
            <div class="input-group" style="margin-bottom: 24px;">
              <label class="input-label" for="select-signaling-mode">Signaling Architecture</label>
              <select id="select-signaling-mode" class="input-select">
                <option value="websocket" selected>WebSocket Server (Cross-device, LAN & Cloud)</option>
                <option value="broadcast">BroadcastChannel (Instant Multi-Tab Local Test)</option>
              </select>
            </div>

            <div style="display:flex; gap: 12px;">
              <button type="submit" class="btn btn-primary" id="btn-start-call" style="flex: 1; padding: 14px 20px;">
                ${icons.phone('', 18)} Start / Join Call
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.previewVideo = this.element.querySelector('#lobby-preview-video');
    this.attachEventListeners();

    return this.element;
  }

  attachEventListeners() {
    this.element.querySelector('#lobby-btn-mic')?.addEventListener('click', () => {
      this.handlers.onToggleAudio?.();
    });

    this.element.querySelector('#lobby-btn-cam')?.addEventListener('click', () => {
      this.handlers.onToggleVideo?.();
    });

    this.element.querySelector('#lobby-btn-settings')?.addEventListener('click', () => {
      this.handlers.onOpenSettings?.();
    });

    this.element.querySelector('#select-signaling-mode')?.addEventListener('change', (e) => {
      this.handlers.onModeChange?.(e.target.value);
    });

    this.element.querySelector('#btn-generate-room')?.addEventListener('click', () => {
      const roomInput = this.element.querySelector('#input-room-id');
      const { generateRoomId } = window.__WEBRTC_UTILS__ || {};
      if (generateRoomId && roomInput) {
        roomInput.value = generateRoomId();
      }
    });

    const form = this.element.querySelector('#lobby-join-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nickname = this.element.querySelector('#input-nickname')?.value.trim();
      const roomId = this.element.querySelector('#input-room-id')?.value.trim();
      const mode = this.element.querySelector('#select-signaling-mode')?.value;

      if (nickname && roomId) {
        this.handlers.onJoinRoom?.({ nickname, roomId, mode });
      }
    });

    // Nickname initial avatar update
    const nickInput = this.element.querySelector('#input-nickname');
    nickInput?.addEventListener('input', (e) => {
      const initial = (e.target.value.trim().charAt(0) || 'U').toUpperCase();
      const avatarInitial = this.element.querySelector('#lobby-avatar-initial');
      if (avatarInitial) avatarInitial.textContent = initial;
    });
  }

  setPreviewStream(stream) {
    if (this.previewVideo) {
      this.previewVideo.srcObject = stream;
    }
  }

  updateMediaState(media) {
    if (!this.element) return;

    const micBtn = this.element.querySelector('#lobby-btn-mic');
    const micIcon = this.element.querySelector('#lobby-mic-icon');
    if (media.audioEnabled) {
      micBtn.classList.remove('danger-active');
      micIcon.innerHTML = icons.mic('', 18);
    } else {
      micBtn.classList.add('danger-active');
      micIcon.innerHTML = icons.micOff('', 18);
    }

    const camBtn = this.element.querySelector('#lobby-btn-cam');
    const camIcon = this.element.querySelector('#lobby-cam-icon');
    const placeholder = this.element.querySelector('#lobby-preview-placeholder');
    if (media.videoEnabled) {
      camBtn.classList.remove('danger-active');
      camIcon.innerHTML = icons.video('', 18);
      if (placeholder) placeholder.style.display = 'none';
    } else {
      camBtn.classList.add('danger-active');
      camIcon.innerHTML = icons.videoOff('', 18);
      if (placeholder) placeholder.style.display = 'flex';
    }
  }

  updateMicLevel(level) {
    if (!this.element) return;
    const bar = this.element.querySelector('#lobby-mic-level');
    const status = this.element.querySelector('#lobby-mic-status');
    if (bar) {
      const pct = Math.min(100, Math.round(level * 100));
      bar.style.width = `${pct}%`;
      if (status) {
        status.textContent = pct > 5 ? 'Speaking' : 'Normal';
      }
    }
  }
}
