/**
 * Abstract Signaling Client Interface
 * Allows seamless switching between WebSocket (remote/LAN peer) and BroadcastChannel (same-browser tab testing).
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';

export class SignalingClient extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.roomId = null;
    this.peerId = null;
  }

  /**
   * Connect to signaling provider
   * @abstract
   */
  async connect() {
    throw new Error('Not implemented');
  }

  /**
   * Join a specific room
   * @abstract
   */
  joinRoom(roomId, peerId, metadata = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Send SDP Offer
   */
  sendOffer(targetPeerId, offer) {
    this.send('offer', targetPeerId, { offer });
  }

  /**
   * Send SDP Answer
   */
  sendAnswer(targetPeerId, answer) {
    this.send('answer', targetPeerId, { answer });
  }

  /**
   * Send ICE Candidate
   */
  sendCandidate(targetPeerId, candidate) {
    this.send('ice-candidate', targetPeerId, { candidate });
  }

  /**
   * Broadcast local media mute/unmute state to remote peers
   */
  sendMediaState(audioEnabled, videoEnabled, isScreenSharing = false) {
    this.send('media-state', null, { audioEnabled, videoEnabled, isScreenSharing });
  }

  /**
   * Send raw signaling message
   * @abstract
   */
  send(type, targetPeerId, payload) {
    throw new Error('Not implemented');
  }

  /**
   * Leave current room and disconnect
   * @abstract
   */
  disconnect() {
    throw new Error('Not implemented');
  }
}
