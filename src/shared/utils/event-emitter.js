/**
 * Lightweight Event Emitter for decoupled feature communication.
 */
export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const remove = this.on(event, (...args) => {
      remove();
      listener(...args);
    });
    return remove;
  }

  off(event, listener) {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
  }

  emit(event, ...args) {
    const listeners = this.events.get(event);
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in listener for event "${event}":`, error);
        }
      }
    }
  }

  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
