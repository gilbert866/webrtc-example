/**
 * Video Stage and Grid Component.
 * Manages remote cinema-view video, draggable/floating local PiP video,
 * audio speaking indicators, and camera-off avatar placeholders.
 */

import { icons } from '../../../shared/ui/icons.js';
import { mediaState } from '../../media/state/media-state.js';
import { callState } from '../state/call-state.js';

export class VideoGrid {
  constructor({ onPiPToggle }) {
    this.onPiPToggle = onPiPToggle;
    this.container = null;
    this.remoteVideo = null;
    this.localVideo = null;
    this.localContainer = null;
    this.remoteContainer = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'video-stage';

    this.container.innerHTML = `
      <!-- Main Cinema Container (Remote Peer) -->
      <div class="video-container" id="remote-video-container">
        <video id="remote-video" class="video-element" autoplay playsinline></video>

        <!-- Placeholder when remote video is disabled -->
        <div class="video-placeholder" id="remote-placeholder">
          <div class="avatar-circle" id="remote-avatar">
            <span id="remote-initial">?</span>
          </div>
          <span style="font-weight: 600; color: var(--text-secondary);" id="remote-placeholder-name">Waiting for participant...</span>
        </div>

        <!-- Remote Overlay Badges -->
        <div class="video-overlay-info">
          <span id="remote-name-label">Remote Peer</span>
          <span id="remote-mic-badge" class="badge badge-danger" style="display: none; padding: 2px 6px;">
            ${icons.micOff('', 12)} Muted
          </span>
        </div>

        <div class="video-overlay-status">
          <button class="btn-icon" id="btn-fullscreen-remote" title="Toggle Fullscreen" style="width: 34px; height: 34px;">
            ${icons.maximize('', 16)}
          </button>
        </div>
      </div>

      <!-- Floating Draggable Picture-in-Picture (Local Peer) -->
      <div class="pip-video-container" id="local-video-container">
        <video id="local-video" class="video-element mirrored" autoplay playsinline muted></video>

        <!-- Placeholder when local video is disabled -->
        <div class="video-placeholder" id="local-placeholder" style="display: none;">
          <div class="avatar-circle" id="local-avatar" style="width: 50px; height: 50px; font-size: 20px;">
            <span id="local-initial">U</span>
          </div>
        </div>

        <!-- Local Overlay Badge -->
        <div class="video-overlay-info" style="bottom: 8px; left: 8px; padding: 4px 8px; font-size: 11px;">
          <span>You</span>
          <span id="local-mic-badge" class="badge badge-danger" style="display: none; padding: 2px 4px; font-size: 10px;">
            ${icons.micOff('', 10)}
          </span>
        </div>
      </div>
    `;

    this.remoteVideo = this.container.querySelector('#remote-video');
    this.localVideo = this.container.querySelector('#local-video');
    this.remoteContainer = this.container.querySelector('#remote-video-container');
    this.localContainer = this.container.querySelector('#local-video-container');

    this.setupFullscreen();
    this.setupPiPDragging();

    return this.container;
  }

  setupFullscreen() {
    const fsBtn = this.container.querySelector('#btn-fullscreen-remote');
    fsBtn?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        this.remoteContainer.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  setupPiPDragging() {
    const el = this.localContainer;
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      el.style.right = 'auto';
      el.style.left = `${initialLeft}px`;
      el.style.top = `${initialTop}px`;
      el.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${initialLeft + dx}px`;
      el.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.style.cursor = 'grab';
      }
    });
  }

  setLocalStream(stream) {
    if (this.localVideo) {
      this.localVideo.srcObject = stream;
    }
  }

  setRemoteStream(stream) {
    if (this.remoteVideo) {
      this.remoteVideo.srcObject = stream;
      const placeholder = this.container.querySelector('#remote-placeholder');
      if (stream && stream.getVideoTracks().length > 0) {
        placeholder.style.display = 'none';
      }
    }
  }

  updatePeerMetadata({ remoteNickname, remoteAudioEnabled, remoteVideoEnabled, isRemoteSpeaking }) {
    const nameLabel = this.container.querySelector('#remote-name-label');
    const placeholderName = this.container.querySelector('#remote-placeholder-name');
    const initial = this.container.querySelector('#remote-initial');
    const placeholder = this.container.querySelector('#remote-placeholder');
    const micBadge = this.container.querySelector('#remote-mic-badge');

    if (remoteNickname) {
      nameLabel.textContent = remoteNickname;
      placeholderName.textContent = remoteNickname;
      initial.textContent = remoteNickname.charAt(0).toUpperCase();
    }

    if (remoteVideoEnabled === false) {
      placeholder.style.display = 'flex';
    } else if (this.remoteVideo && this.remoteVideo.srcObject && this.remoteVideo.srcObject.getVideoTracks().length > 0) {
      placeholder.style.display = 'none';
    }

    if (micBadge) {
      micBadge.style.display = remoteAudioEnabled === false ? 'inline-flex' : 'none';
    }

    // Speaking glow
    if (this.remoteContainer) {
      if (isRemoteSpeaking) {
        this.remoteContainer.classList.add('speaking');
      } else {
        this.remoteContainer.classList.remove('speaking');
      }
    }
  }

  updateLocalState({ videoEnabled, audioEnabled, isSpeaking, isScreenSharing }) {
    const placeholder = this.container.querySelector('#local-placeholder');
    const micBadge = this.container.querySelector('#local-mic-badge');

    if (placeholder) {
      placeholder.style.display = videoEnabled ? 'none' : 'flex';
    }
    if (micBadge) {
      micBadge.style.display = audioEnabled ? 'none' : 'inline-flex';
    }

    if (this.localVideo) {
      // Don't mirror screen shares
      if (isScreenSharing) {
        this.localVideo.classList.remove('mirrored');
      } else {
        this.localVideo.classList.add('mirrored');
      }
    }

    if (this.localContainer) {
      if (isSpeaking) {
        this.localContainer.style.borderColor = 'var(--color-primary)';
      } else {
        this.localContainer.style.borderColor = 'var(--glass-border)';
      }
    }
  }
}
