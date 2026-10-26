/**
 * Reactive Call State Machine.
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';

export const CallStatus = {
  IDLE: 'idle',
  LOBBY: 'lobby',
  CALLING: 'calling',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ENDED: 'ended'
};

export class CallStateStore extends EventEmitter {
  constructor() {
    super();
    this.timer = null;
    this.state = this.getInitialState();
  }

  getInitialState() {
    return {
      status: CallStatus.LOBBY,
      callType: 'video', // 'video' or 'audio'
      roomId: '',
      peerId: '',
      nickname: 'User',
      remotePeerId: null,
      remoteNickname: 'Remote Peer',
      remoteAudioEnabled: true,
      remoteVideoEnabled: true,
      isLocalSpeaking: false,
      isRemoteSpeaking: false,
      callDurationSec: 0,
      stats: null,
      unreadMessagesCount: 0
    };
  }

  get() {
    return this.state;
  }

  set(updates) {
    const prev = { ...this.state };
    this.state = { ...this.state, ...updates };
    this.emit('change', this.state, prev);
  }

  setStatus(status) {
    const prevStatus = this.state.status;
    this.set({ status });

    if (status === CallStatus.CONNECTED && prevStatus !== CallStatus.CONNECTED) {
      this.startDurationTimer();
    } else if (status === CallStatus.ENDED || status === CallStatus.IDLE || status === CallStatus.LOBBY) {
      this.stopDurationTimer();
    }
  }

  startDurationTimer() {
    this.stopDurationTimer();
    this.set({ callDurationSec: 0 });
    this.timer = setInterval(() => {
      this.set({ callDurationSec: this.state.callDurationSec + 1 });
    }, 1000);
  }

  stopDurationTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reset() {
    this.stopDurationTimer();
    this.state = {
      ...this.getInitialState(),
      roomId: this.state.roomId,
      peerId: this.state.peerId,
      nickname: this.state.nickname
    };
    this.emit('change', this.state);
  }
}

export const callState = new CallStateStore();
