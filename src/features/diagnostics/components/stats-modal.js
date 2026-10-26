/**
 * WebRTC Live Diagnostics & Quality Inspector Modal.
 */

import { Modal } from '../../../shared/ui/modal.js';
import { icons } from '../../../shared/ui/icons.js';

export class StatsModal {
  constructor() {
    this.modal = null;
    this.updateInterval = null;
    this.latestStats = null;
  }

  show(statsCollector) {
    const content = `
      <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13.5px;">
        <div class="glass-panel" style="padding: 14px;">
          <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">Latency (Round Trip)</div>
          <div id="stat-rtt" style="font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--color-success);">-- ms</div>
        </div>

        <div class="glass-panel" style="padding: 14px;">
          <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">Packet Loss</div>
          <div id="stat-loss" style="font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--color-primary);">0%</div>
        </div>

        <div class="glass-panel" style="padding: 14px;">
          <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">Video Resolution / FPS</div>
          <div id="stat-resolution" style="font-family: var(--font-mono); font-size: 15px; font-weight: 600;">--</div>
        </div>

        <div class="glass-panel" style="padding: 14px;">
          <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">Video Codec</div>
          <div id="stat-video-codec" style="font-family: var(--font-mono); font-size: 15px; font-weight: 600;">--</div>
        </div>

        <div class="glass-panel" style="padding: 14px;">
          <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">Video In / Out Bitrate</div>
          <div id="stat-video-bitrate" style="font-family: var(--font-mono); font-size: 14px; font-weight: 600;">-- kbps / -- kbps</div>
        </div>

        <div class="glass-panel" style="padding: 14px;">
          <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">Audio Codec & Bitrate</div>
          <div id="stat-audio" style="font-family: var(--font-mono); font-size: 14px; font-weight: 600;">--</div>
        </div>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.25); border-radius: var(--radius-md); font-size: 12px; color: var(--text-secondary);">
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <span>ICE Connection Candidate:</span>
          <span id="stat-ice-type" style="color: var(--text-primary); font-family: var(--font-mono);">STUN / Host</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Encryption Protocol:</span>
          <span style="color: var(--color-success); font-family: var(--font-mono);">DTLS / SRTP (AES-128)</span>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-primary" id="btn-close-stats">Close</button>
    `;

    this.modal = new Modal({
      title: `${icons.activity('', 18)} Real-Time WebRTC Diagnostics`,
      content,
      footer,
      onOpen: (el) => {
        el.querySelector('#btn-close-stats')?.addEventListener('click', () => {
          this.modal.close();
        });

        // Listen for live updates
        const unbind = statsCollector?.on('stats', (metrics) => {
          this.updateMetrics(el, metrics);
        });

        this.onCloseCleanup = unbind;
      },
      onClose: () => {
        if (this.onCloseCleanup) this.onCloseCleanup();
      }
    });

    this.modal.render();
  }

  updateMetrics(el, m) {
    if (!el || !m) return;

    const rttEl = el.querySelector('#stat-rtt');
    const lossEl = el.querySelector('#stat-loss');
    const resEl = el.querySelector('#stat-resolution');
    const vCodecEl = el.querySelector('#stat-video-codec');
    const vBitrateEl = el.querySelector('#stat-video-bitrate');
    const audioEl = el.querySelector('#stat-audio');
    const iceEl = el.querySelector('#stat-ice-type');

    if (rttEl) rttEl.textContent = `${m.rttMs} ms`;
    if (lossEl) lossEl.textContent = `${m.packetLossRate}%`;
    if (resEl) resEl.textContent = `${m.videoResolution} @ ${m.videoFps} fps`;
    if (vCodecEl) vCodecEl.textContent = m.videoCodec || 'VP8 / H.264';
    if (vBitrateEl) vBitrateEl.textContent = `↓ ${m.inboundVideoBitrateKbps} kbps / ↑ ${m.outboundVideoBitrateKbps} kbps`;
    if (audioEl) audioEl.textContent = `${m.audioCodec || 'opus'} (↓ ${m.inboundAudioBitrateKbps} kbps)`;
    if (iceEl) iceEl.textContent = m.candidateType || 'Host / STUN';
  }
}
