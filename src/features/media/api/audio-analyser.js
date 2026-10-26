/**
 * Voice Activity & Audio Level Analyser.
 * Evaluates audio energy (RMS) from a MediaStream to drive speaking indicators.
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';

export class AudioLevelAnalyser extends EventEmitter {
  constructor(options = {}) {
    super();
    this.threshold = options.threshold || 0.04;
    this.smoothing = options.smoothing || 0.8;
    this.intervalMs = options.intervalMs || 60;

    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.timer = null;
    this.isSpeaking = false;
    this.currentLevel = 0;
  }

  attachStream(stream) {
    this.detach();

    if (!stream || stream.getAudioTracks().length === 0) {
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = this.smoothing;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.timer = setInterval(() => {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(1, average / 128); // 0 to 1
        this.currentLevel = normalized;

        this.emit('level', normalized);

        const speaking = normalized > this.threshold;
        if (speaking !== this.isSpeaking) {
          this.isSpeaking = speaking;
          this.emit('speaking', speaking);
        }
      }, this.intervalMs);
    } catch (err) {
      console.warn('[AudioLevelAnalyser] Failed to attach audio stream for analysis:', err);
    }
  }

  detach() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {}
      this.source = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (_) {}
      this.analyser = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.emit('speaking', false);
    }
    this.currentLevel = 0;
  }
}
