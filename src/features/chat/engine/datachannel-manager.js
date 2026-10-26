/**
 * DataChannel Messaging Manager.
 * Orchestrates reliable multi-peer P2P text chat and data exchange over RTCDataChannel.
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';
import { sound } from '../../../shared/utils/sound.js';

export class DataChannelManager extends EventEmitter {
  constructor(initialEngine = null) {
    super();
    this.peers = new Map(); // peerId -> PeerConnectionEngine
    this.messages = [];
    this.seenMessageIds = new Set();

    if (initialEngine) {
      this.addPeer('default', initialEngine);
    }
  }

  addPeer(peerId, peerConnectionEngine) {
    if (!peerConnectionEngine) return;
    this.peers.set(peerId, peerConnectionEngine);

    peerConnectionEngine.on('datachannel-message', (rawData) => {
      this.handleIncomingRaw(rawData, peerId);
    });
  }

  removePeer(peerId) {
    this.peers.delete(peerId);
  }

  setEngine(peerConnectionEngine) {
    this.addPeer('default', peerConnectionEngine);
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
    this.seenMessageIds.add(message.id);
    this.emit('message', message);

    const payload = {
      type: 'text',
      id: message.id,
      text: message.text,
      senderNickname,
      timestamp: message.timestamp
    };

    // Broadcast message over RTCDataChannel to all connected peers in room
    for (const [id, peerEngine] of this.peers.entries()) {
      try {
        peerEngine.sendData(payload);
      } catch (err) {
        console.warn(`[DataChannelManager] Failed to send message to peer ${id}:`, err);
      }
    }

    return message;
  }

  handleIncomingRaw(rawData, senderPeerId) {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (data.type === 'text') {
        // Prevent duplicate messages if delivered multiple times
        if (data.id && this.seenMessageIds.has(data.id)) {
          return;
        }
        if (data.id) {
          this.seenMessageIds.add(data.id);
        }

        const message = {
          id: data.id || `msg-${Date.now()}`,
          type: 'text',
          text: data.text,
          senderNickname: data.senderNickname || 'Participant',
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: false,
          senderPeerId
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
    this.seenMessageIds.clear();
  }
}
