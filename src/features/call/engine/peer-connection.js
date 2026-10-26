/**
 * WebRTC PeerConnection Engine.
 * Implements the W3C Perfect Negotiation pattern, glare avoidance,
 * ICE candidate buffering, and seamless RTP track swapping.
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';
import { Logger } from '../../../shared/utils/logger.js';
import { DEFAULT_RTC_CONFIGURATION } from './ice-servers.js';

export class PeerConnectionEngine extends EventEmitter {
  constructor({ targetPeerId, isPolite = false, rtcConfig = DEFAULT_RTC_CONFIGURATION }) {
    super();
    this.targetPeerId = targetPeerId;
    this.isPolite = isPolite;
    this.rtcConfig = rtcConfig;
    this.logger = new Logger(`WebRTC:${targetPeerId.slice(0, 8)}`);

    this.pc = null;
    this.remoteStream = new MediaStream();
    this.localStream = null;

    // Perfect Negotiation state guards
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;

    // ICE candidate buffer
    this.candidateQueue = [];

    // DataChannel
    this.dataChannel = null;

    this.initPeerConnection();
  }

  initPeerConnection() {
    this.pc = new RTCPeerConnection(this.rtcConfig);

    // Negotiating WebRTC offer when tracks are added or renegotiation is needed
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        this.logger.info('onnegotiationneeded: generating local offer');
        await this.pc.setLocalDescription();
        this.emit('signal-offer', {
          targetPeerId: this.targetPeerId,
          offer: this.pc.localDescription
        });
      } catch (err) {
        this.logger.error('Negotiation error during offer generation:', err);
      } finally {
        this.makingOffer = false;
      }
    };

    // Forward local ICE candidate to remote peer
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('signal-candidate', {
          targetPeerId: this.targetPeerId,
          candidate: event.candidate
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      this.logger.info(`ICE Connection State: ${state}`);
      this.emit('ice-state-change', state);

      if (state === 'failed') {
        this.logger.warn('ICE connection failed, triggering ICE restart');
        this.restartIce();
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.logger.info(`Peer Connection State: ${state}`);
      this.emit('connection-state-change', state);
    };

    // Receive remote media tracks
    this.pc.ontrack = (event) => {
      this.logger.info(`Received remote track: ${event.track.kind} (${event.track.id})`);
      this.remoteStream.addTrack(event.track);

      event.track.onended = () => {
        this.logger.info(`Remote track ended: ${event.track.kind}`);
        this.remoteStream.removeTrack(event.track);
      };

      this.emit('remote-stream', this.remoteStream);
    };

    // Incoming DataChannel created by remote peer
    this.pc.ondatachannel = (event) => {
      this.logger.info('Remote created DataChannel');
      this.setupDataChannel(event.channel);
    };
  }

  /**
   * Set local media stream and attach all tracks to peer connection
   */
  setLocalStream(stream) {
    this.localStream = stream;
    if (!stream) return;

    stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, stream);
    });
  }

  /**
   * Seamlessly replace an audio or video track mid-call without renegotiation
   */
  async replaceTrack(kind, newTrack) {
    let sender = this.pc.getSenders().find(s => s.track && s.track.kind === kind);
    if (!sender) {
      const transceiver = this.pc.getTransceivers?.().find(t =>
        (t.receiver?.track?.kind === kind) ||
        (t.sender?.track?.kind === kind)
      );
      if (transceiver?.sender) {
        sender = transceiver.sender;
      }
    }

    if (sender) {
      this.logger.info(`Replacing ${kind} track via RTCRtpSender.replaceTrack`);
      await sender.replaceTrack(newTrack || null);
    } else if (newTrack) {
      this.logger.info(`Adding new ${kind} track via addTrack`);
      const stream = this.localStream || new MediaStream();
      this.pc.addTrack(newTrack, stream);
    }
  }

  /**
   * Handle incoming remote SDP offer (W3C Perfect Negotiation)
   */
  async handleRemoteOffer(offer) {
    try {
      const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
      this.ignoreOffer = !this.isPolite && offerCollision;

      if (this.ignoreOffer) {
        this.logger.warn('Offer collision detected. Impolite peer is ignoring remote offer.');
        return;
      }

      this.isSettingRemoteAnswerPending = offer.type === 'answer';
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      this.isSettingRemoteAnswerPending = false;

      // Drain queued ICE candidates
      await this.drainCandidateQueue();

      if (offer.type === 'offer') {
        await this.pc.setLocalDescription();
        this.emit('signal-answer', {
          targetPeerId: this.targetPeerId,
          answer: this.pc.localDescription
        });
      }
    } catch (err) {
      this.logger.error('Error handling remote offer:', err);
    }
  }

  /**
   * Handle incoming remote SDP answer
   */
  async handleRemoteAnswer(answer) {
    try {
      if (this.pc.signalingState === 'have-local-offer') {
        this.isSettingRemoteAnswerPending = true;
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        this.isSettingRemoteAnswerPending = false;
        await this.drainCandidateQueue();
      } else {
        this.logger.warn(`Unexpected signaling state for answer: ${this.pc.signalingState}`);
      }
    } catch (err) {
      this.logger.error('Error handling remote answer:', err);
    }
  }

  /**
   * Handle incoming remote ICE Candidate with buffering
   */
  async handleRemoteCandidate(candidateInit) {
    try {
      const candidate = new RTCIceCandidate(candidateInit);
      if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
        this.logger.debug('Buffering ICE candidate until remote description is set');
        this.candidateQueue.push(candidate);
        return;
      }
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer) {
        this.logger.warn('Error adding ICE candidate:', err);
      }
    }
  }

  /**
   * Flush queued candidates once remote description is ready
   */
  async drainCandidateQueue() {
    if (this.candidateQueue.length === 0) return;
    this.logger.info(`Draining ${this.candidateQueue.length} buffered ICE candidates`);

    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (err) {
        this.logger.warn('Error draining candidate:', err);
      }
    }
  }

  /**
   * Create an outgoing DataChannel for real-time text chat / data
   */
  createDataChannel(label = 'chat') {
    if (!this.pc) return null;
    const dc = this.pc.createDataChannel(label, { ordered: true });
    this.setupDataChannel(dc);
    return dc;
  }

  setupDataChannel(dc) {
    this.dataChannel = dc;

    dc.onopen = () => {
      this.logger.info(`DataChannel "${dc.label}" opened.`);
      this.emit('datachannel-open', dc);
    };

    dc.onclose = () => {
      this.logger.info(`DataChannel "${dc.label}" closed.`);
      this.emit('datachannel-close');
    };

    dc.onmessage = (event) => {
      this.emit('datachannel-message', event.data);
    };

    dc.onerror = (err) => {
      this.logger.error('DataChannel error:', err);
    };
  }

  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Request ICE restart (e.g. on network switch or failed state)
   */
  restartIce() {
    if (typeof this.pc.restartIce === 'function') {
      this.pc.restartIce();
    }
  }

  async getStats() {
    if (!this.pc) return null;
    return await this.pc.getStats();
  }

  close() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (_) {}
      this.dataChannel = null;
    }

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.onnegotiationneeded = null;
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream.getTracks().forEach(t => t.stop());
    this.remoteStream = new MediaStream();
    this.candidateQueue = [];
  }
}
