/**
 * Node.js events module shim for QuickJS engine.
 *
 * CRITICAL: EventEmitter MUST be the default export (as a class) because
 * libraries like Jimp do `class Jimp extends events` expecting to extend
 * EventEmitter directly.
 */

class EventEmitter {
  private _events: Record<string, Function[]> = {};
  private _maxListeners = 10;

  static defaultMaxListeners = 10;

  on(event: string, listener: Function) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(listener);
    return this;
  }

  once(event: string, listener: Function) {
    const wrapped = (...args: any[]) => {
      this.off(event, wrapped);
      listener.apply(this, args);
    };
    return this.on(event, wrapped);
  }

  off(event: string, listener: Function) {
    const listeners = this._events[event];
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
    return this;
  }

  removeListener(event: string, listener: Function) {
    return this.off(event, listener);
  }

  addListener(event: string, listener: Function) {
    return this.on(event, listener);
  }

  emit(event: string, ...args: any[]) {
    const listeners = this._events[event];
    if (!listeners || listeners.length === 0) return false;
    for (const listener of listeners) {
      try {
        listener.apply(this, args);
      } catch (e) {
        // Ignore errors in event handlers
      }
    }
    return true;
  }

  removeAllListeners(event?: string) {
    if (event) delete this._events[event];
    else this._events = {};
    return this;
  }

  listeners(event: string) {
    return this._events[event] || [];
  }

  listenerCount(event: string) {
    return this.listeners(event).length;
  }

  eventNames() {
    return Object.keys(this._events);
  }

  setMaxListeners(n: number) {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners() {
    return this._maxListeners;
  }

  prependListener(event: string, listener: Function) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].unshift(listener);
    return this;
  }

  prependOnceListener(event: string, listener: Function) {
    const wrapped = (...args: any[]) => {
      this.off(event, wrapped);
      listener.apply(this, args);
    };
    return this.prependListener(event, wrapped);
  }

  rawListeners(event: string) {
    return this.listeners(event);
  }
}

function once(emitter: EventEmitter, event: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const errorListener = (err: Error) => {
      emitter.off(event, resolver);
      reject(err);
    };
    const resolver = (...args: any[]) => {
      emitter.off('error', errorListener);
      resolve(args);
    };
    emitter.once(event, resolver);
    emitter.once('error', errorListener);
  });
}

// Make EventEmitter the default export AND attach properties for CommonJS compat
// This allows both:
//   - `class X extends events` (extends EventEmitter)
//   - `events.EventEmitter` (access the class)
//   - `events.once(...)` (utility function)
const eventsModule = Object.assign(EventEmitter, {
  EventEmitter,
  once,
  default: EventEmitter,
}) as typeof EventEmitter & {
  EventEmitter: typeof EventEmitter;
  once: typeof once;
  default: typeof EventEmitter;
};

export { EventEmitter, once };
export default eventsModule;
