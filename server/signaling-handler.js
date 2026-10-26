/**
 * Core WebSocket signaling server handler.
 * Handles room management, peer discovery, SDP offer/answer exchange,
 * and ICE candidate forwarding for WebRTC peers.
 */

export class SignalingServerHandler {
  constructor() {
    // Map of roomId -> Map of peerId -> { ws, metadata }
    this.rooms = new Map();
    // Map of ws -> { roomId, peerId, metadata }
    this.connections = new Map();
  }

  /**
   * Handle incoming WebSocket connection
   * @param {import('ws').WebSocket} ws
   * @param {import('http').IncomingMessage} req
   */
  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.processMessage(ws, message);
      } catch (err) {
        console.error('[SignalingServer] Malformed JSON message:', err);
        this.sendError(ws, 'Malformed JSON message');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('[SignalingServer] WebSocket socket error:', err);
      this.handleDisconnect(ws);
    });
  }

  /**
   * Process signaling protocol message
   */
  processMessage(ws, message) {
    const { type, roomId, peerId, targetPeerId, payload } = message;

    switch (type) {
      case 'join':
        this.handleJoin(ws, roomId, peerId, payload);
        break;

      case 'leave':
        this.handleLeave(ws);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'media-state':
      case 'chat-message':
        this.forwardToPeer(ws, type, targetPeerId, payload);
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        console.warn(`[SignalingServer] Unknown message type: ${type}`);
    }
  }

  handleJoin(ws, roomId, peerId, metadata = {}) {
    if (!roomId || !peerId) {
      this.sendError(ws, 'roomId and peerId are required to join');
      return;
    }

    // If client was previously in a room, clean up first
    if (this.connections.has(ws)) {
      this.handleLeave(ws);
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const room = this.rooms.get(roomId);

    // Collect list of existing peers in room to notify the joining peer
    const existingPeers = [];
    for (const [existingPeerId, peerData] of room.entries()) {
      existingPeers.push({
        peerId: existingPeerId,
        metadata: peerData.metadata
      });
    }

    // Register peer in room
    room.set(peerId, { ws, metadata });
    this.connections.set(ws, { roomId, peerId, metadata });

    console.log(`[SignalingServer] Peer ${peerId} joined room "${roomId}". Total peers in room: ${room.size}`);

    // Confirm joined to caller with existing peers list
    this.send(ws, {
      type: 'joined',
      roomId,
      peerId,
      existingPeers
    });

    // Notify other peers in the room about the new participant
    for (const [otherPeerId, peerData] of room.entries()) {
      if (otherPeerId !== peerId && peerData.ws.readyState === 1 /* OPEN */) {
        this.send(peerData.ws, {
          type: 'peer-joined',
          roomId,
          peerId,
          metadata
        });
      }
    }
  }

  handleLeave(ws) {
    const info = this.connections.get(ws);
    if (!info) return;

    const { roomId, peerId } = info;
    this.connections.delete(ws);

    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(peerId);
      console.log(`[SignalingServer] Peer ${peerId} left room "${roomId}". Remaining: ${room.size}`);

      // Broadcast peer-left to remaining participants
      for (const [otherPeerId, peerData] of room.entries()) {
        if (peerData.ws.readyState === 1 /* OPEN */) {
          this.send(peerData.ws, {
            type: 'peer-left',
            roomId,
            peerId
          });
        }
      }

      if (room.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[SignalingServer] Room "${roomId}" is now empty and removed`);
      }
    }
  }

  handleDisconnect(ws) {
    this.handleLeave(ws);
  }

  forwardToPeer(ws, type, targetPeerId, payload) {
    const info = this.connections.get(ws);
    if (!info) {
      this.sendError(ws, 'Not registered in any room');
      return;
    }

    const { roomId, peerId } = info;
    const room = this.rooms.get(roomId);

    if (!room) {
      this.sendError(ws, 'Room not found');
      return;
    }

    // Direct routing to a specific peer
    if (targetPeerId) {
      const target = room.get(targetPeerId);
      if (target && target.ws.readyState === 1 /* OPEN */) {
        this.send(target.ws, {
          type,
          roomId,
          senderPeerId: peerId,
          payload
        });
      } else {
        console.warn(`[SignalingServer] Target peer ${targetPeerId} not found or disconnected`);
      }
      return;
    }

    // Broadcast to all other peers in the room
    for (const [otherPeerId, peerData] of room.entries()) {
      if (otherPeerId !== peerId && peerData.ws.readyState === 1 /* OPEN */) {
        this.send(peerData.ws, {
          type,
          roomId,
          senderPeerId: peerId,
          payload
        });
      }
    }
  }

  send(ws, message) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, error) {
    this.send(ws, { type: 'error', error });
  }

  /**
   * Setup periodic heartbeat interval to clear stale connections
   */
  startHeartbeat(intervalMs = 30000) {
    return setInterval(() => {
      for (const [ws] of this.connections.entries()) {
        if (ws.isAlive === false) {
          console.log('[SignalingServer] Terminating unresponsive connection');
          ws.terminate();
          this.handleDisconnect(ws);
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, intervalMs);
  }
}
