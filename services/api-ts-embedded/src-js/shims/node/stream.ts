/**
 * Node.js stream module shim for QuickJS engine.
 *
 * Uses function constructors with proper prototype chains so that:
 * - `util.inherits(MyStream, Stream)` works
 * - `class MyStream extends Stream` works
 * - `new Readable()` works
 */

// Base Stream
function Stream(this: any) {
  if (!(this instanceof Stream)) return new (Stream as any)();
}
Stream.prototype.pipe = function(dest: any) { return dest; };
Stream.prototype.on = function(_e: string, _cb: Function) { return this; };
Stream.prototype.once = function(_e: string, _cb: Function) { return this; };
Stream.prototype.emit = function(_e: string, ..._args: any[]) { return false; };
Stream.prototype.removeListener = function(_e: string, _cb: Function) { return this; };
Stream.prototype.removeAllListeners = function(_e?: string) { return this; };
Stream.prototype.setMaxListeners = function(_n: number) { return this; };
Stream.prototype.getMaxListeners = function() { return 10; };
Stream.prototype.listeners = function(_e: string) { return []; };
Stream.prototype.listenerCount = function(_e: string) { return 0; };
Stream.prototype.eventNames = function() { return []; };

// Readable
function Readable(this: any, _opts?: any) {
  if (!(this instanceof Readable)) return new (Readable as any)(_opts);
  Stream.call(this);
}
Readable.prototype = Object.create(Stream.prototype);
Readable.prototype.constructor = Readable;
Readable.prototype.read = function(_size?: number) { return null; };
Readable.prototype.push = function(_chunk: any) { return true; };
Readable.prototype.unshift = function(_chunk: any) {};
Readable.prototype.destroy = function(_err?: Error) { return this; };
Readable.prototype.pause = function() { return this; };
Readable.prototype.resume = function() { return this; };
Readable.prototype.isPaused = function() { return false; };
Readable.prototype.setEncoding = function(_enc: string) { return this; };
Readable.prototype.unpipe = function(_dest?: any) { return this; };
Readable.prototype.wrap = function(_stream: any) { return this; };
Readable.prototype[Symbol.asyncIterator] = function*() {};

// Writable
function Writable(this: any, _opts?: any) {
  if (!(this instanceof Writable)) return new (Writable as any)(_opts);
  Stream.call(this);
}
Writable.prototype = Object.create(Stream.prototype);
Writable.prototype.constructor = Writable;
Writable.prototype.write = function(_chunk: any, _enc?: any, _cb?: Function) {
  if (typeof _cb === 'function') _cb();
  return true;
};
Writable.prototype.end = function(_chunk?: any, _enc?: any, _cb?: Function) {
  if (typeof _chunk === 'function') _chunk();
  else if (typeof _enc === 'function') _enc();
  else if (typeof _cb === 'function') _cb();
  return this;
};
Writable.prototype.destroy = function(_err?: Error) { return this; };
Writable.prototype.cork = function() {};
Writable.prototype.uncork = function() {};
Writable.prototype.setDefaultEncoding = function(_enc: string) { return this; };

// Duplex
function Duplex(this: any, _opts?: any) {
  if (!(this instanceof Duplex)) return new (Duplex as any)(_opts);
  Readable.call(this, _opts);
}
Duplex.prototype = Object.create(Readable.prototype);
Object.assign(Duplex.prototype, Writable.prototype);
Duplex.prototype.constructor = Duplex;

// Transform
function Transform(this: any, _opts?: any) {
  if (!(this instanceof Transform)) return new (Transform as any)(_opts);
  Duplex.call(this, _opts);
}
Transform.prototype = Object.create(Duplex.prototype);
Transform.prototype.constructor = Transform;
Transform.prototype._transform = function(_chunk: any, _enc: string, cb: Function) { cb(); };
Transform.prototype._flush = function(cb: Function) { cb(); };

// PassThrough
function PassThrough(this: any, _opts?: any) {
  if (!(this instanceof PassThrough)) return new (PassThrough as any)(_opts);
  Transform.call(this, _opts);
}
PassThrough.prototype = Object.create(Transform.prototype);
PassThrough.prototype.constructor = PassThrough;

// Utility functions
function pipeline(...args: any[]) {
  const cb = args[args.length - 1];
  if (typeof cb === 'function') setTimeout(() => cb(null), 0);
  return args[args.length - 2] || new (PassThrough as any)();
}

function finished(stream: any, opts: any, cb?: Function) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if (typeof cb === 'function') setTimeout(() => cb!(null), 0);
  return () => {};
}

const promises = {
  pipeline: async (..._args: any[]) => {},
  finished: async (_stream: any, _opts?: any) => {},
};

// Default export: Stream with all classes attached (CommonJS compat)
const streamModule = Object.assign(Stream, {
  Stream,
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
  pipeline,
  finished,
  promises,
});

export {
  Stream,
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
  pipeline,
  finished,
  promises,
};
export default streamModule;
