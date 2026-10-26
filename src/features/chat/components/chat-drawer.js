/**
 * Slide-out In-Call Chat Drawer Component.
 */

import { icons } from '../../../shared/ui/icons.js';

export class ChatDrawer {
  constructor({ onSendMessage, onClose }) {
    this.onSendMessage = onSendMessage;
    this.onClose = onClose;
    this.element = null;
    this.isOpen = false;
  }

  render() {
    this.element = document.createElement('aside');
    this.element.className = 'side-drawer hidden';

    this.element.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title">
          ${icons.message('', 18)} In-Call P2P Chat
        </div>
        <button class="btn-icon btn-close-drawer" aria-label="Close chat" style="width: 32px; height: 32px;">
          ${icons.close('', 16)}
        </button>
      </div>

      <div class="drawer-content" id="chat-messages-container">
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; margin: auto;">
          Messages are encrypted and transmitted directly peer-to-peer via RTCDataChannel.
        </div>
      </div>

      <div class="drawer-footer">
        <form id="chat-form" style="display: flex; gap: 8px;">
          <input 
            type="text" 
            id="chat-input" 
            class="input-text" 
            placeholder="Type a message..." 
            autocomplete="off" 
            style="padding: 10px 14px; font-size: 13.5px;"
          />
          <button type="submit" class="btn btn-primary" style="padding: 10px 14px; border-radius: var(--radius-md);">
            ${icons.send('', 16)}
          </button>
        </form>
      </div>
    `;

    const closeBtn = this.element.querySelector('.btn-close-drawer');
    closeBtn?.addEventListener('click', () => this.toggle(false));

    const form = this.element.querySelector('#chat-form');
    const input = this.element.querySelector('#chat-input');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        this.onSendMessage?.(text);
        input.value = '';
      }
    });

    return this.element;
  }

  toggle(forceOpen) {
    this.isOpen = typeof forceOpen === 'boolean' ? forceOpen : !this.isOpen;
    if (this.isOpen) {
      this.element.classList.remove('hidden');
      setTimeout(() => {
        const input = this.element.querySelector('#chat-input');
        input?.focus();
      }, 100);
    } else {
      this.element.classList.add('hidden');
      this.onClose?.();
    }
    return this.isOpen;
  }

  appendMessage(msg) {
    const container = this.element.querySelector('#chat-messages-container');
    if (!container) return;

    // Remove the empty placeholder if present
    const placeholder = container.querySelector('div[style*="text-align: center"]');
    if (placeholder) {
      placeholder.remove();
    }

    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${msg.isSelf ? 'sent' : 'received'} animate-fade-in`;

    msgEl.innerHTML = `
      <div class="chat-meta">
        <span>${msg.isSelf ? 'You' : msg.senderNickname}</span>
        <span>•</span>
        <span>${msg.timestamp}</span>
      </div>
      <div class="chat-bubble">
        ${this.escapeHtml(msg.text)}
      </div>
    `;

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  clear() {
    const container = this.element.querySelector('#chat-messages-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; margin: auto;">
          Messages are encrypted and transmitted directly peer-to-peer via RTCDataChannel.
        </div>
      `;
    }
  }
}
