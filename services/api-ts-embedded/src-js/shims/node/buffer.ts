/**
 * Node.js buffer module shim for QuickJS engine.
 * Re-exports Buffer from globalThis (provided by web-api-shim.js).
 */

const Buffer = (globalThis as any).Buffer;

// SlowBuffer is deprecated but some packages still use it
const SlowBuffer = Buffer;

// Constants
const kMaxLength = 0x7fffffff;
const kStringMaxLength = 0x3fffffff;

// Utility functions
function isBuffer(obj: any): boolean {
  return obj instanceof Buffer;
}

function isEncoding(encoding: string): boolean {
  return ['utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'base64', 'hex', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le']
    .includes(encoding.toLowerCase());
}

function byteLength(str: string, encoding?: string): number {
  return Buffer.byteLength(str, encoding);
}

function concat(list: Buffer[], totalLength?: number): Buffer {
  return Buffer.concat(list, totalLength);
}

function compare(buf1: Buffer, buf2: Buffer): number {
  return Buffer.compare(buf1, buf2);
}

// Default export
const bufferModule = {
  Buffer,
  SlowBuffer,
  kMaxLength,
  kStringMaxLength,
  isBuffer,
  isEncoding,
  byteLength,
  concat,
  compare,
  constants: {
    MAX_LENGTH: kMaxLength,
    MAX_STRING_LENGTH: kStringMaxLength,
  },
};

export { Buffer, SlowBuffer, kMaxLength, kStringMaxLength, isBuffer, isEncoding, byteLength, concat, compare };
export default bufferModule;
