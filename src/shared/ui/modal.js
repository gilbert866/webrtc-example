/**
 * Base Modal Controller for accessible glassmorphic dialogs.
 */

import { icons } from './icons.js';

export class Modal {
  constructor({ title, content, footer, onOpen, onClose }) {
    this.title = title || '';
    this.content = content || '';
    this.footer = footer || null;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.overlay = null;
  }

  render() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    this.overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-title">${this.title}</div>
          <button class="btn-icon btn-close-modal" aria-label="Close modal">
            ${icons.close('', 18)}
          </button>
        </div>
        <div class="modal-body">
          ${this.content}
        </div>
        ${this.footer ? `<div class="modal-footer">${this.footer}</div>` : ''}
      </div>
    `;

    // Close handlers
    const closeBtn = this.overlay.querySelector('.btn-close-modal');
    closeBtn?.addEventListener('click', () => this.close());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Escape key
    this.keydownHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    window.addEventListener('keydown', this.keydownHandler);

    document.body.appendChild(this.overlay);

    if (this.onOpen) {
      this.onOpen(this.overlay);
    }

    return this.overlay;
  }

  close() {
    if (this.overlay) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.overlay.remove();
      this.overlay = null;
      if (this.onClose) this.onClose();
    }
  }

  getElement() {
    return this.overlay;
  }
}
