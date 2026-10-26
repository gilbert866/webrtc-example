/**
 * Call Control Dock Component.
 * Floating glassmorphic dock offering instantaneous media toggles,
 * screen share, settings, chat, and call termination.
 */

import { icons } from '../../../shared/ui/icons.js';
import { mediaState } from '../../media/state/media-state.js';
import { callState } from '../state/call-state.js';

export class CallControls {
  constructor({
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
    onToggleChat,
    onOpenStats,
    onOpenSettings,
    onHangup
  }) {
    this.handlers = {
      onToggleAudio,
      onToggleVideo,
      onToggleScreenShare,
      onToggleChat,
      onOpenStats,
      onOpenSettings,
      onHangup
    };
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'control-dock';

    this.element.innerHTML = `
      <!-- Microphone Toggle -->
      <button class="btn-icon" id="btn-toggle-mic" title="Mute/Unmute Mic" aria-label="Microphone">
        <span class="icon-wrap" id="mic-icon-wrap">${icons.mic('', 20)}</span>
      </button>

      <!-- Video Camera Toggle -->
      <button class="btn-icon" id="btn-toggle-cam" title="Turn Camera On/Off" aria-label="Camera">
        <span class="icon-wrap" id="cam-icon-wrap">${icons.video('', 20)}</span>
      </button>

      <!-- Screen Share Toggle -->
      <button class="btn-icon" id="btn-toggle-screen" title="Share Screen" aria-label="Share Screen">
        <span class="icon-wrap" id="screen-icon-wrap">${icons.screenShare('', 20)}</span>
      </button>

      <div class="dock-separator"></div>

      <!-- In-Call Chat Drawer Toggle -->
      <button class="btn-icon" id="btn-toggle-chat" title="Open P2P Chat" aria-label="Chat" style="position: relative;">
        ${icons.message('', 20)}
        <span id="chat-unread-badge" class="badge badge-danger" style="display:none; position:absolute; top:-4px; right:-4px; padding:2px 5px; font-size:10px; border-radius:10px;">0</span>
      </button>

      <!-- WebRTC Live Diagnostics / Quality Stats -->
      <button class="btn-icon" id="btn-toggle-stats" title="WebRTC Diagnostics & Stats" aria-label="Call Stats">
        ${icons.activity('', 20)}
      </button>

      <!-- Device & Media Settings -->
      <button class="btn-icon" id="btn-open-settings" title="Device Settings" aria-label="Settings">
        ${icons.settings('', 20)}
      </button>

      <div class="dock-separator"></div>

      <!-- Hang Up / Leave Call -->
      <button class="btn btn-danger btn-icon" id="btn-hangup" title="Leave Call" aria-label="End Call" style="width: 48px; height: 48px; border-radius: var(--radius-pill);">
        ${icons.phoneOff('', 22)}
      </button>
    `;

    this.attachEventListeners();
    return this.element;
  }

  attachEventListeners() {
    this.element.querySelector('#btn-toggle-mic')?.addEventListener('click', () => {
      this.handlers.onToggleAudio?.();
    });

    this.element.querySelector('#btn-toggle-cam')?.addEventListener('click', () => {
      this.handlers.onToggleVideo?.();
    });

    this.element.querySelector('#btn-toggle-screen')?.addEventListener('click', () => {
      this.handlers.onToggleScreenShare?.();
    });

    this.element.querySelector('#btn-toggle-chat')?.addEventListener('click', () => {
      this.handlers.onToggleChat?.();
    });

    this.element.querySelector('#btn-toggle-stats')?.addEventListener('click', () => {
      this.handlers.onOpenStats?.();
    });

    this.element.querySelector('#btn-open-settings')?.addEventListener('click', () => {
      this.handlers.onOpenSettings?.();
    });

    this.element.querySelector('#btn-hangup')?.addEventListener('click', () => {
      this.handlers.onHangup?.();
    });
  }

  updateMediaState(media) {
    if (!this.element) return;

    const micBtn = this.element.querySelector('#btn-toggle-mic');
    const micWrap = this.element.querySelector('#mic-icon-wrap');
    if (media.audioEnabled) {
      micBtn.classList.remove('danger-active');
      micWrap.innerHTML = icons.mic('', 20);
      micBtn.title = 'Mute Microphone';
    } else {
      micBtn.classList.add('danger-active');
      micWrap.innerHTML = icons.micOff('', 20);
      micBtn.title = 'Unmute Microphone';
    }

    const camBtn = this.element.querySelector('#btn-toggle-cam');
    const camWrap = this.element.querySelector('#cam-icon-wrap');
    if (media.videoEnabled) {
      camBtn.classList.remove('danger-active');
      camWrap.innerHTML = icons.video('', 20);
      camBtn.title = 'Turn off Camera';
    } else {
      camBtn.classList.add('danger-active');
      camWrap.innerHTML = icons.videoOff('', 20);
      camBtn.title = 'Turn on Camera';
    }

    const screenBtn = this.element.querySelector('#btn-toggle-screen');
    const screenWrap = this.element.querySelector('#screen-icon-wrap');
    if (media.isScreenSharing) {
      screenBtn.classList.add('active');
      screenWrap.innerHTML = icons.screenShareOff('', 20);
      screenBtn.title = 'Stop Sharing Screen';
    } else {
      screenBtn.classList.remove('active');
      screenWrap.innerHTML = icons.screenShare('', 20);
      screenBtn.title = 'Share Screen';
    }
  }

  updateUnreadCount(count) {
    if (!this.element) return;
    const badge = this.element.querySelector('#chat-unread-badge');
    if (badge) {
      if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = count > 9 ? '9+' : count;
      } else {
        badge.style.display = 'none';
      }
    }
  }
}
