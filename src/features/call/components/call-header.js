/**
 * In-Call Header Component.
 * Displays room identity, copy link, encrypted status, duration, and RTT latency.
 */

import { icons } from '../../../shared/ui/icons.js';
import { toast } from '../../../shared/ui/toast.js';

export class CallHeader {
  constructor({ onLeave }) {
    this.onLeave = onLeave;
    this.element = null;
  }

  render() {
    this.element = document.createElement('header');
    this.element.className = 'top-nav';

    this.element.innerHTML = `
      <div class="brand-group">
        <div class="brand-logo">
          ${icons.shield('', 20)}
        </div>
        <div>
          <span class="brand-name">WebRTC Pro</span>
          <div style="font-size: 11px; color: var(--color-success); display:flex; align-items:center; gap:4px;">
            ${icons.shield('', 10)} End-to-End Encrypted P2P
          </div>
        </div>
      </div>

      <div class="room-badge-wrap">
        <!-- Room ID with copy button -->
        <button class="btn btn-secondary" id="btn-copy-room" style="padding: 6px 12px; font-size: 13px;">
          <span style="color: var(--text-muted); font-size: 12px;">Room:</span>
          <span id="header-room-id" style="font-family: var(--font-mono); font-weight: 700;">---</span>
          <span id="copy-icon-wrap">${icons.copy('', 14)}</span>
        </button>

        <!-- Participant Count Badge -->
        <div class="badge badge-secondary" id="call-participant-badge" title="Participants in room" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding: 6px 10px;">
          ${icons.users('', 14)}
          <span id="header-participant-count">1 participant</span>
        </div>

        <!-- Call Duration Counter -->
        <div class="badge badge-info" id="call-timer-badge" style="font-family: var(--font-mono); font-size: 13px;">
          00:00
        </div>

        <!-- Latency / Health Pill -->
        <div class="badge badge-success" id="call-health-badge" title="Round Trip Time">
          <span class="badge-dot pulse"></span>
          <span id="header-rtt-text">P2P Ready</span>
        </div>
      </div>
    `;

    const copyBtn = this.element.querySelector('#btn-copy-room');
    copyBtn?.addEventListener('click', () => {
      const roomId = this.element.querySelector('#header-room-id').textContent;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast.success('Room invite link copied to clipboard!');
        const wrap = this.element.querySelector('#copy-icon-wrap');
        wrap.innerHTML = icons.check('', 14);
        setTimeout(() => {
          wrap.innerHTML = icons.copy('', 14);
        }, 2000);
      }).catch(() => {
        toast.info(`Room ID: ${roomId}`);
      });
    });

    return this.element;
  }

  setRoomId(roomId) {
    if (!this.element) return;
    const el = this.element.querySelector('#header-room-id');
    if (el) el.textContent = roomId;
  }

  updateParticipantCount(count) {
    if (!this.element) return;
    const el = this.element.querySelector('#header-participant-count');
    if (el) {
      el.textContent = `${count} ${count === 1 ? 'participant' : 'participants'}`;
    }
  }

  updateDuration(seconds) {
    if (!this.element) return;
    const badge = this.element.querySelector('#call-timer-badge');
    if (!badge) return;

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    badge.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  updateLatency(rttMs) {
    if (!this.element) return;
    const badge = this.element.querySelector('#call-health-badge');
    const text = this.element.querySelector('#header-rtt-text');
    if (!badge || !text) return;

    if (!rttMs || rttMs <= 0) {
      text.textContent = 'Connected';
      badge.className = 'badge badge-success';
      return;
    }

    text.textContent = `${rttMs} ms`;
    if (rttMs < 80) {
      badge.className = 'badge badge-success';
    } else if (rttMs < 200) {
      badge.className = 'badge badge-warning';
    } else {
      badge.className = 'badge badge-danger';
    }
  }

  setConnectionStatus(status) {
    if (!this.element) return;
    const badge = this.element.querySelector('#call-health-badge');
    const text = this.element.querySelector('#header-rtt-text');
    if (!badge || !text) return;

    if (status === 'reconnecting') {
      text.textContent = 'Reconnecting...';
      badge.className = 'badge badge-warning';
    } else if (status === 'connected') {
      text.textContent = 'Connected';
      badge.className = 'badge badge-success';
    }
  }
}
