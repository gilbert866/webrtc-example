/**
 * Reactive Media State Store.
 * Centralizes local camera, microphone, and screen share states.
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';

export class MediaStateStore extends EventEmitter {
  constructor() {
    super();
    this.state = {
      audioEnabled: true,
      videoEnabled: true,
      isScreenSharing: false,
      activeAudioDeviceId: '',
      activeVideoDeviceId: '',
      activeAudioOutputDeviceId: '',
      availableDevices: {
        audioInputs: [],
        videoInputs: [],
        audioOutputs: []
      }
    };
  }

  get() {
    return this.state;
  }

  set(updates) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };
    this.emit('change', this.state, prevState);
  }

  toggleAudio() {
    this.set({ audioEnabled: !this.state.audioEnabled });
    return this.state.audioEnabled;
  }

  toggleVideo() {
    this.set({ videoEnabled: !this.state.videoEnabled });
    return this.state.videoEnabled;
  }

  setScreenSharing(isSharing) {
    this.set({ isScreenSharing: isSharing });
  }

  setDevices(devices) {
    this.set({ availableDevices: devices });
  }

  setActiveAudioDevice(deviceId) {
    this.set({ activeAudioDeviceId: deviceId });
  }

  setActiveVideoDevice(deviceId) {
    this.set({ activeVideoDeviceId: deviceId });
  }

  setActiveAudioOutputDevice(deviceId) {
    this.set({ activeAudioOutputDeviceId: deviceId });
  }
}

export const mediaState = new MediaStateStore();
