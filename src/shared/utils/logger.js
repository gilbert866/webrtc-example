/**
 * Structured, colored console logger for WebRTC lifecycle and feature tracing.
 */
const MODULE_COLORS = {
  WebRTC: '#6366f1',
  Media: '#10b981',
  Signaling: '#f59e0b',
  DataChannel: '#ec4899',
  App: '#06b6d4',
  Stats: '#8b5cf6'
};

export class Logger {
  constructor(moduleName = 'App') {
    this.module = moduleName;
    this.color = MODULE_COLORS[moduleName] || '#94a3b8';
  }

  format(level, message) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return [`%c[${time}] %c[${this.module}] %c${message}`, 'color: #64748b; font-weight: normal;', `color: ${this.color}; font-weight: bold;`, 'color: inherit;'];
  }

  info(message, ...args) {
    const [fmt, ...styles] = this.format('INFO', message);
    console.log(fmt, ...styles, ...args);
  }

  warn(message, ...args) {
    const [fmt, ...styles] = this.format('WARN', message);
    console.warn(fmt, ...styles, ...args);
  }

  error(message, ...args) {
    const [fmt, ...styles] = this.format('ERROR', message);
    console.error(fmt, ...styles, ...args);
  }

  debug(message, ...args) {
    if (window.__DEBUG_WEBRTC__) {
      const [fmt, ...styles] = this.format('DEBUG', message);
      console.debug(fmt, ...styles, ...args);
    }
  }
}
