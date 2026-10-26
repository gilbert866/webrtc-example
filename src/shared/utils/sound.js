/**
 * Pure Web Audio API Sound Synthesizer.
 * Creates clean acoustic feedback without needing external sound files or CDN requests.
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.ringtoneTimer = null;
    this.ringbackTimer = null;
    this.muted = false;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq, duration = 0.2, type = 'sine', gain = 0.1, delay = 0) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * Incoming call ringtone (repeating pleasant harmonic chime)
   */
  startRingtone() {
    this.stopRingtone();
    const playBurst = () => {
      // Pleasant marimba-like sequence (E5, G#5, B5, E6)
      const notes = [659.25, 830.61, 987.77, 1318.51];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 0.25, 'triangle', 0.12, idx * 0.1);
      });
      setTimeout(() => {
        notes.forEach((freq, idx) => {
          this.playTone(freq, 0.25, 'triangle', 0.12, idx * 0.1);
        });
      }, 600);
    };

    playBurst();
    this.ringtoneTimer = setInterval(playBurst, 2500);
  }

  stopRingtone() {
    if (this.ringtoneTimer) {
      clearInterval(this.ringtoneTimer);
      this.ringtoneTimer = null;
    }
  }

  /**
   * Outgoing call ringback tone (intermittent standard dual tone)
   */
  startRingback() {
    this.stopRingback();
    const playRing = () => {
      this.playTone(440, 1.2, 'sine', 0.05);
      this.playTone(480, 1.2, 'sine', 0.05);
    };

    playRing();
    this.ringbackTimer = setInterval(playRing, 3500);
  }

  stopRingback() {
    if (this.ringbackTimer) {
      clearInterval(this.ringbackTimer);
      this.ringbackTimer = null;
    }
  }

  /**
   * Call connected chime
   */
  playConnect() {
    this.stopRingback();
    this.stopRingtone();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.35, 'sine', 0.08, idx * 0.08);
    });
  }

  /**
   * Call ended tone
   */
  playHangup() {
    this.stopRingback();
    this.stopRingtone();
    const notes = [783.99, 659.25, 523.25]; // G5, E5, C5
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.3, 'sine', 0.08, idx * 0.1);
    });
  }

  /**
   * Mic toggle sound
   */
  playMute(isMuted) {
    if (isMuted) {
      this.playTone(400, 0.08, 'triangle', 0.05);
      this.playTone(300, 0.12, 'triangle', 0.05, 0.08);
    } else {
      this.playTone(300, 0.08, 'triangle', 0.05);
      this.playTone(500, 0.12, 'triangle', 0.05, 0.08);
    }
  }

  /**
   * In-call chat message pop
   */
  playMessage() {
    this.playTone(880, 0.08, 'sine', 0.05);
  }
}

export const sound = new SoundManager();
