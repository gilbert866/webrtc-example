/**
 * WebRTC Stats Monitor.
 * Collects, aggregates, and calculates real-time call performance metrics
 * (bitrate, packet loss, RTT, resolution, framerate, and codecs).
 */

import { EventEmitter } from '../../../shared/utils/event-emitter.js';

export class CallStatsCollector extends EventEmitter {
  constructor(peerConnectionEngine) {
    super();
    this.engine = peerConnectionEngine;
    this.intervalId = null;
    this.prevStats = null;
    this.prevTimestamp = 0;
  }

  start(intervalMs = 1000) {
    this.stop();
    this.intervalId = setInterval(async () => {
      await this.collect();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.prevStats = null;
    this.prevTimestamp = 0;
  }

  async collect() {
    if (!this.engine) return;

    try {
      const stats = await this.engine.getStats();
      if (!stats) return;

      const currentTimestamp = Date.now();
      const timeDiffSec = this.prevTimestamp ? (currentTimestamp - this.prevTimestamp) / 1000 : 1;
      this.prevTimestamp = currentTimestamp;

      const metrics = {
        rttMs: 0,
        inboundVideoBitrateKbps: 0,
        outboundVideoBitrateKbps: 0,
        inboundAudioBitrateKbps: 0,
        outboundAudioBitrateKbps: 0,
        videoResolution: 'N/A',
        videoFps: 0,
        audioCodec: 'N/A',
        videoCodec: 'N/A',
        packetLossRate: 0,
        candidateType: 'N/A'
      };

      const codecMap = new Map();
      stats.forEach((report) => {
        if (report.type === 'codec') {
          codecMap.set(report.id, report.mimeType?.split('/')[1] || report.mimeType);
        }
      });

      stats.forEach((report) => {
        // Round trip time from candidate-pair
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime !== undefined) {
            metrics.rttMs = Math.round(report.currentRoundTripTime * 1000);
          }
          if (report.nominated) {
            metrics.candidateType = report.localCandidateId ? 'STUN / Direct' : 'Direct';
          }
        }

        // Inbound RTP (what we are receiving from remote peer)
        if (report.type === 'inbound-rtp') {
          const prev = this.prevStats?.get(report.id);
          const bytesDiff = prev ? report.bytesReceived - prev.bytesReceived : 0;
          const bitrate = Math.round((bytesDiff * 8) / (timeDiffSec * 1000));

          if (report.kind === 'video') {
            metrics.inboundVideoBitrateKbps = Math.max(0, bitrate);
            metrics.videoResolution = report.frameWidth && report.frameHeight 
              ? `${report.frameWidth}x${report.frameHeight}` 
              : metrics.videoResolution;
            metrics.videoFps = report.framesPerSecond || metrics.videoFps;
            if (report.codecId && codecMap.has(report.codecId)) {
              metrics.videoCodec = codecMap.get(report.codecId);
            }

            // Packet loss
            if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
              const total = report.packetsLost + report.packetsReceived;
              if (total > 0) {
                metrics.packetLossRate = Math.min(100, Math.round((report.packetsLost / total) * 100));
              }
            }
          } else if (report.kind === 'audio') {
            metrics.inboundAudioBitrateKbps = Math.max(0, bitrate);
            if (report.codecId && codecMap.has(report.codecId)) {
              metrics.audioCodec = codecMap.get(report.codecId);
            }
          }
        }

        // Outbound RTP (what we are sending to remote peer)
        if (report.type === 'outbound-rtp') {
          const prev = this.prevStats?.get(report.id);
          const bytesDiff = prev ? report.bytesSent - prev.bytesSent : 0;
          const bitrate = Math.round((bytesDiff * 8) / (timeDiffSec * 1000));

          if (report.kind === 'video') {
            metrics.outboundVideoBitrateKbps = Math.max(0, bitrate);
            if (!metrics.videoCodec && report.codecId && codecMap.has(report.codecId)) {
              metrics.videoCodec = codecMap.get(report.codecId);
            }
          } else if (report.kind === 'audio') {
            metrics.outboundAudioBitrateKbps = Math.max(0, bitrate);
            if (!metrics.audioCodec && report.codecId && codecMap.has(report.codecId)) {
              metrics.audioCodec = codecMap.get(report.codecId);
            }
          }
        }
      });

      this.prevStats = stats;
      this.emit('stats', metrics);
    } catch (err) {
      console.warn('[CallStatsCollector] Error collecting stats:', err);
    }
  }
}
