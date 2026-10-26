/**
 * Incoming Call Modal.
 * Alerts user of an incoming call with ringtone chime and acceptance options.
 */

import { Modal } from '../../../shared/ui/modal.js';
import { icons } from '../../../shared/ui/icons.js';
import { sound } from '../../../shared/utils/sound.js';

export class IncomingCallModal {
  constructor({ callerName, onAccept, onDecline }) {
    this.callerName = callerName || 'Remote Peer';
    this.onAccept = onAccept;
    this.onDecline = onDecline;
    this.modal = null;
  }

  show() {
    sound.startRingtone();

    const content = `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 0; gap: 16px;">
        <div class="avatar-circle speaking" style="width: 80px; height: 80px; font-size: 32px;">
          ${this.callerName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${this.callerName}</h3>
          <p style="color: var(--text-secondary); font-size: 14px;">Incoming audio & video call...</p>
        </div>
      </div>
    `;

    const footer = `
      <div style="display:flex; justify-content:center; gap: 16px; width:100%;">
        <button class="btn btn-danger" id="btn-decline-call" style="flex:1;">
          ${icons.phoneOff('', 18)} Decline
        </button>
        <button class="btn btn-primary" id="btn-accept-call" style="flex:1; background: var(--color-success); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
          ${icons.phone('', 18)} Answer
        </button>
      </div>
    `;

    this.modal = new Modal({
      title: `${icons.phoneIncoming('', 18)} Incoming Call`,
      content,
      footer,
      onOpen: (el) => {
        el.querySelector('#btn-accept-call')?.addEventListener('click', () => {
          sound.stopRingtone();
          this.modal.close();
          this.onAccept?.();
        });

        el.querySelector('#btn-decline-call')?.addEventListener('click', () => {
          sound.stopRingtone();
          this.modal.close();
          this.onDecline?.();
        });
      },
      onClose: () => {
        sound.stopRingtone();
      }
    });

    this.modal.render();
  }

  close() {
    if (this.modal) {
      sound.stopRingtone();
      this.modal.close();
      this.modal = null;
    }
  }
}
