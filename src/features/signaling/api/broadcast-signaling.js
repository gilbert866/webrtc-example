/**
 * BroadcastChannel Signaling Client.
 * Enables zero-server, instant multi-tab WebRTC calling on the same browser/machine.
 */

import { SignalingClient } from './signaling-client.js';
import { Logger } from '../../../shared/utils/logger.js';

export class BroadcastSignalingClient extends SignalingClient {
  constructor() {
    super();
    this.logger = new Logger('Signaling');
    this.channel = null;
    this.channelName = null;
    this.metadata = {};
  }

  async connect() {
    this.connected = true;
    this.emit('connected');
    return Promise.resolve();
  }

  joinRoom(roomId, peerId, metadata = {}) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.metadata = metadata;

    if (this.channel) {
      this.channel.close();
    }

    this.channelName = `webrtc_room_${roomId}`;
    this.channel = new BroadcastChannel(this.channelName);

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.logger.info(`BroadcastChannel active for room "${roomId}" as peer "${peerId}"`);

    // Announce presence
    this.sendRaw({
      type: 'peer-joined',
      roomId,
      peerId,
      metadata
    });

    this.emit('joined', { roomId, peerId, existingPeers: [] });
  }

  handleMessage(msg) {
    if (!msg || msg.senderPeerId === this.peerId) {
      return; // Ignore our own messages
    }

    const { type, senderPeerId, targetPeerId, payload, metadata } = msg;

    if (targetPeerId && targetPeerId !== this.peerId) {
      return; // Not addressed to us
    }

    switch (type) {
      case 'peer-joined':
        this.emit('peer-joined', { peerId: msg.peerId, metadata });
        // Answer our presence back to the newcomer
        this.sendRaw({
          type: 'peer-joined-ack',
          roomId: this.roomId,
          peerId: this.peerId,
          targetPeerId: msg.peerId,
          metadata: this.metadata
        });
        break;

      case 'peer-joined-ack':
        this.emit('peer-joined', { peerId: msg.peerId, metadata });
        break;

      case 'peer-left':
        this.emit('peer-left', { peerId: msg.peerId });
        break;

      case 'offer':
        this.emit('offer', { senderPeerId, offer: payload.offer });
        break;

      case 'answer':
        this.emit('answer', { senderPeerId, answer: payload.answer });
        break;

      case 'ice-candidate':
        this.emit('ice-candidate', { senderPeerId, candidate: payload.candidate });
        break;

      case 'media-state':
        this.emit('media-state', { senderPeerId, mediaState: payload });
        break;
    }
  }

  send(type, targetPeerId, payload) {
    this.sendRaw({
      type,
      roomId: this.roomId,
      senderPeerId: this.peerId,
      targetPeerId,
      payload
    });
  }

  sendRaw(data) {
    if (this.channel) {
      this.channel.postMessage(data);
    }
  }

  disconnect() {
    if (this.channel) {
      this.sendRaw({
        type: 'peer-left',
        roomId: this.roomId,
        peerId: this.peerId
      });
      this.channel.close();
      this.channel = null;
    }
    this.connected = false;
  }
}
