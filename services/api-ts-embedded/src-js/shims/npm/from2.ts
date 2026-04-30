/**
 * from2 shim - creates readable streams from a function.
 * Uses function constructors (not ES6 class) for QuickJS compatibility.
 */
import { Readable } from '../node/stream';

// From2Stream constructor
function From2Stream(this: any, opts?: any, readFn?: Function) {
  if (!(this instanceof From2Stream)) {
    return new (From2Stream as any)(opts, readFn);
  }

  // Handle both from2(fn) and from2(opts, fn) signatures
  if (typeof opts === 'function') {
    readFn = opts;
    opts = {};
  }

  // Call parent constructor
  Readable.call(this, opts);

  this._readFn = readFn || function() {};
  this._destroyed = false;
}

// Set up prototype chain
From2Stream.prototype = Object.create(Readable.prototype);
From2Stream.prototype.constructor = From2Stream;

From2Stream.prototype._read = function(size: number) {
  if (this._destroyed) return;

  const self = this;
  this._readFn.call(this, size, function(err: Error | null, chunk?: any) {
    if (err) {
      self.destroy(err);
      return;
    }
    if (chunk !== undefined) {
      self.push(chunk);
    }
  });
};

From2Stream.prototype.destroy = function(err?: Error) {
  if (this._destroyed) return this;
  this._destroyed = true;
  if (err) this.emit('error', err);
  this.emit('close');
  return this;
};

// Main function - from2([opts], read)
function from2(opts?: any, read?: Function): any {
  return new (From2Stream as any)(opts, read);
}

// from2.obj([opts], read) - object mode
from2.obj = function(opts?: any, read?: Function): any {
  if (typeof opts === 'function') {
    read = opts;
    opts = {};
  }
  opts = opts || {};
  opts.objectMode = true;
  return new (From2Stream as any)(opts, read);
};

// from2.ctor([opts]) - returns constructor
from2.ctor = function(_opts?: any) {
  return From2Stream;
};

export default from2;
export { from2, From2Stream };
