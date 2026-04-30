/**
 * concat-stream shim - collects stream data into a single buffer.
 * Uses function constructors (not ES6 class) for QuickJS compatibility.
 */
import { Writable } from '../node/stream';

// ConcatStream constructor
function ConcatStream(this: any, opts?: any, callback?: Function) {
  if (!(this instanceof ConcatStream)) {
    return new (ConcatStream as any)(opts, callback);
  }

  // Handle both concat(cb) and concat(opts, cb) signatures
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  // Call parent constructor
  Writable.call(this, opts);

  this._chunks = [];
  this._callback = callback || function() {};
  this._encoding = opts?.encoding;
}

// Set up prototype chain
ConcatStream.prototype = Object.create(Writable.prototype);
ConcatStream.prototype.constructor = ConcatStream;

ConcatStream.prototype._write = function(chunk: any, _encoding: string, callback: Function) {
  this._chunks.push(chunk);
  callback();
};

ConcatStream.prototype.end = function(chunk?: any, encoding?: any, callback?: Function) {
  if (typeof chunk === 'function') {
    callback = chunk;
    chunk = undefined;
  }
  if (typeof encoding === 'function') {
    callback = encoding;
    encoding = undefined;
  }

  if (chunk !== undefined) {
    this._chunks.push(chunk);
  }

  // Concatenate all chunks
  const result = this._concatChunks();
  this._callback(result);

  if (callback) callback();
  this.emit('finish');

  return this;
};

ConcatStream.prototype._concatChunks = function() {
  if (this._chunks.length === 0) {
    return Buffer.alloc(0);
  }

  // Check if we have Buffer/Uint8Array chunks
  const firstChunk = this._chunks[0];

  if (Buffer.isBuffer(firstChunk) || firstChunk instanceof Uint8Array) {
    // Concatenate as buffers
    let totalLength = 0;
    for (let i = 0; i < this._chunks.length; i++) {
      totalLength += this._chunks[i].length;
    }
    const result = Buffer.alloc(totalLength);
    let offset = 0;
    for (let i = 0; i < this._chunks.length; i++) {
      const chunk = this._chunks[i];
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      buf.copy(result, offset);
      offset += buf.length;
    }

    if (this._encoding === 'string') {
      return result.toString();
    }
    return result;
  }

  if (typeof firstChunk === 'string') {
    return this._chunks.join('');
  }

  // Object mode - return array
  return this._chunks;
};

// Main function - concat([opts], callback)
function concat(opts?: any, callback?: Function): any {
  return new (ConcatStream as any)(opts, callback);
}

export default concat;
export { concat, ConcatStream };
