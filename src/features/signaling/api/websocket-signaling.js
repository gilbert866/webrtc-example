/**
 * Production-ready WebSocket Signaling Client.
 * Features automated reconnection with exponential backoff and connection state tracking.
 */

import { SignalingClient } from './signaling-client.js';
import { Logger } from '../../../shared/utils/logger.js';

export class WebSocketSignalingClient extends SignalingClient {
  constructor(wsUrl = null) {
    super();
    this.logger = new Logger('Signaling');
    
    // Auto-detect WebSocket URL based on current origin if not provided
    if (!wsUrl) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.wsUrl = `${proto}//${window.location.host}/ws`;
    } else {
      this.wsUrl = wsUrl;
    }

    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.isExplicitDisconnect = false;
    this.metadata = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.isExplicitDisconnect = false;
      this.logger.info(`Connecting to WebSocket signaling: ${this.wsUrl}`);

      try {
        this.ws = new WebSocket(this.wsUrl);
      } catch (err) {
        this.logger.error('Failed to instantiate WebSocket:', err);
        return reject(err);
      }

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connection established.');
        this.startPing();
        this.emit('connected');

        // If reconnecting and room was previously joined, re-join
        if (this.roomId && this.peerId) {
          this.joinRoom(this.roomId, this.peerId, this.metadata);
        }

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          this.logger.error('Failed to parse incoming signaling message:', err);
        }
      };

      this.ws.onerror = (err) => {
        this.logger.warn('WebSocket encountered error:', err);
        this.emit('error', err);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.stopPing();
        this.emit('disconnected');

        if (!this.isExplicitDisconnect) {
          this.scheduleReconnect();
        }
      };
    });
  }

  handleMessage(msg) {
    const { type, roomId, peerId, senderPeerId, existingPeers, payload, error } = msg;

    switch (type) {
      case 'joined':
        this.emit('joined', { roomId, peerId, existingPeers });
        break;

      case 'peer-joined':
        this.logger.info(`Peer joined: ${peerId}`);
        this.emit('peer-joined', { peerId, metadata: msg.metadata });
        break;

      case 'peer-left':
        this.logger.info(`Peer left: ${peerId}`);
        this.emit('peer-left', { peerId });
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

      case 'pong':
        // Heartbeat acknowledged
        break;

      case 'error':
        this.logger.error('Server reported error:', error);
        this.emit('error', error);
        break;

      default:
        this.logger.warn('Unknown message type received:', type);
    }
  }

  joinRoom(roomId, peerId, metadata = {}) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.metadata = metadata;

    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Not connected yet, queuing join on connect');
      return;
    }

    this.sendRaw({
      type: 'join',
      roomId,
      peerId,
      payload: metadata
    });
  }

  send(type, targetPeerId, payload) {
    this.sendRaw({
      type,
      roomId: this.roomId,
      peerId: this.peerId,
      targetPeerId,
      payload
    });
  }

  sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    } else {
      this.logger.warn('Cannot send, WebSocket is not OPEN');
    }
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      this.emit('reconnect-failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;
    this.logger.info(`Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  disconnect() {
    this.isExplicitDisconnect = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      if (this.roomId && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'leave' }));
        } catch (_) {}
      }
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
