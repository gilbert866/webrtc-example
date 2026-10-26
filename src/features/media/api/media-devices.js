/**
 * Media Devices API Service.
 * Manages webcam, microphone, screen share streams, constraints, and device enumeration.
 */

import { Logger } from '../../../shared/utils/logger.js';

export class MediaDeviceService {
  constructor() {
    this.logger = new Logger('Media');
    this.localStream = null;
    this.screenStream = null;
    this.cameraTrackBackup = null;
  }

  /**
   * Request user media with optimal default WebRTC constraints
   */
  async getLocalStream(constraints = {}) {
    const defaultConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      },
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user'
      }
    };

    const finalConstraints = {
      audio: constraints.audio !== undefined ? constraints.audio : defaultConstraints.audio,
      video: constraints.video !== undefined ? constraints.video : defaultConstraints.video
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
      this.logger.info('Acquired local media stream successfully:', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length
      });
      return this.localStream;
    } catch (err) {
      this.logger.error('Failed to get user media:', err);
      throw this.normalizeMediaError(err);
    }
  }

  /**
   * Request display media for screen sharing
   */
  async getScreenStream() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });
      return this.screenStream;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        this.logger.info('User canceled screen sharing prompt.');
        return null;
      }
      this.logger.error('Failed to capture screen stream:', err);
      throw err;
    }
  }

  /**
   * Enumerate connected hardware devices (microphones, cameras, speakers)
   */
  async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        videoInputs: devices.filter(d => d.kind === 'videoinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput')
      };
    } catch (err) {
      this.logger.error('Failed to enumerate devices:', err);
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
  }

  /**
   * Switch active video input device (e.g. front camera to back camera, or external webcam)
   */
  async switchVideoDevice(deviceId) {
    if (!this.localStream) return null;

    const oldTrack = this.localStream.getVideoTracks()[0];
    if (oldTrack) {
      oldTrack.stop();
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
      }
      this.localStream.addTrack(newTrack);
      return newTrack;
    } catch (err) {
      this.logger.error('Failed to switch video device:', err);
      throw err;
    }
  }

  /**
   * Switch active microphone
   */
  async switchAudioDevice(deviceId) {
    if (!this.localStream) return null;

    const oldTrack = this.localStream.getAudioTracks()[0];
    if (oldTrack) {
      oldTrack.stop();
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
      }
      this.localStream.addTrack(newTrack);
      return newTrack;
    } catch (err) {
      this.logger.error('Failed to switch audio device:', err);
      throw err;
    }
  }

  /**
   * Set speaker output device for an audio/video element (where supported by browser)
   */
  async setAudioOutput(element, sinkId) {
    if (typeof element.setSinkId === 'function') {
      try {
        await element.setSinkId(sinkId);
        this.logger.info(`Audio output set to sinkId: ${sinkId}`);
      } catch (err) {
        this.logger.warn('Failed to set audio sink ID:', err);
      }
    }
  }

  /**
   * Stop all active media tracks
   */
  stopAll() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }

  normalizeMediaError(err) {
    let friendlyMessage = 'Could not access camera or microphone.';
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        friendlyMessage = 'Permission denied. Please grant camera and microphone permissions in browser settings.';
        break;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        friendlyMessage = 'No camera or microphone found on this device.';
        break;
      case 'NotReadableError':
      case 'TrackStartError':
        friendlyMessage = 'Hardware device is in use by another application.';
        break;
      case 'OverconstrainedError':
        friendlyMessage = 'Hardware does not satisfy required resolution or settings.';
        break;
    }
    const error = new Error(friendlyMessage);
    error.name = err.name;
    error.original = err;
    return error;
  }
}

export const mediaDeviceService = new MediaDeviceService();
