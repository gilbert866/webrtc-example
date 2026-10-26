/**
 * DataChannel Messaging Manager.
 * Orchestrates reliable P2P text chat and data exchange over RTCDataChannel.
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';
import { sound } from '../../../shared/utils/sound.js';

export class DataChannelManager extends EventEmitter {
  constructor(peerConnectionEngine) {
    super();
    this.engine = peerConnectionEngine;
    this.messages = [];
  }

  setEngine(peerConnectionEngine) {
    this.engine = peerConnectionEngine;
    if (this.engine) {
      this.engine.on('datachannel-message', (rawData) => {
        this.handleIncomingRaw(rawData);
      });
    }
  }

  sendMessage(text, senderNickname) {
    if (!text || !text.trim()) return null;

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'text',
      text: text.trim(),
      senderNickname,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true
    };

    this.messages.push(message);
    this.emit('message', message);

    if (this.engine) {
      const payload = {
        type: 'text',
        id: message.id,
        text: message.text,
        senderNickname,
        timestamp: message.timestamp
      };
      this.engine.sendData(payload);
    }

    return message;
  }

  handleIncomingRaw(rawData) {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (data.type === 'text') {
        const message = {
          id: data.id,
          type: 'text',
          text: data.text,
          senderNickname: data.senderNickname || 'Peer',
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: false
        };
        this.messages.push(message);
        sound.playMessage();
        this.emit('message', message);
      }
    } catch (err) {
      console.warn('[DataChannelManager] Failed to parse message:', err);
    }
  }

  clear() {
    this.messages = [];
  }
}
