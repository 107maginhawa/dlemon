/**
 * Node.js crypto shim - bridges to Web Crypto API for embedded mode.
 * Implements the subset of Node.js crypto that hapihub uses.
 */

// Use globalThis.crypto which is shimmed in web-api-shim.js
const webcrypto = globalThis.crypto;

// randomFillSync - fills a buffer with random bytes synchronously
export function randomFillSync(buffer: any, offset = 0, size?: number): any {
  const len = size ?? buffer.length - offset;
  const bytes = new Uint8Array(len);
  webcrypto.getRandomValues(bytes);

  // Handle Buffer (update both _bytes and index properties for array-like access)
  if (buffer._bytes) {
    for (let i = 0; i < len; i++) {
      buffer._bytes[offset + i] = bytes[i];
      buffer[offset + i] = bytes[i];  // Also update index property
    }
  } else if (buffer instanceof Uint8Array) {
    for (let i = 0; i < len; i++) {
      buffer[offset + i] = bytes[i];
    }
  }

  return buffer;
}

// randomBytes - returns a buffer with random bytes
export function randomBytes(size: number): Buffer {
  const bytes = new Uint8Array(size);
  webcrypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

// randomUUID
export function randomUUID(): string {
  return webcrypto.randomUUID();
}

// createHash - stub for hash creation
export function createHash(algorithm: string) {
  return {
    update(_data: any) { return this; },
    digest(_encoding?: string) {
      console.warn('[crypto] createHash is stubbed - returning empty');
      return '';
    },
  };
}

// createHmac - stub for HMAC
export function createHmac(algorithm: string, key: any) {
  return {
    update(_data: any) { return this; },
    digest(_encoding?: string) {
      console.warn('[crypto] createHmac is stubbed - returning empty');
      return '';
    },
  };
}

// timingSafeEqual - constant-time comparison
export function timingSafeEqual(a: any, b: any): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  const aBytes = a._bytes || a;
  const bBytes = b._bytes || b;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

// pbkdf2 - stub
export function pbkdf2(
  password: any,
  salt: any,
  iterations: number,
  keylen: number,
  digest: string,
  callback: (err: Error | null, derivedKey?: Buffer) => void
) {
  console.warn('[crypto] pbkdf2 is stubbed');
  callback(null, Buffer.alloc(keylen));
}

export function pbkdf2Sync(
  password: any,
  salt: any,
  iterations: number,
  keylen: number,
  digest: string
): Buffer {
  console.warn('[crypto] pbkdf2Sync is stubbed');
  return Buffer.alloc(keylen);
}

// Stub classes
export class Hash {
  update(_data: any) { return this; }
  digest(_encoding?: string) { return ''; }
}

export class Hmac {
  update(_data: any) { return this; }
  digest(_encoding?: string) { return ''; }
}

// Constants
export const constants = {
  RSA_PKCS1_PADDING: 1,
  RSA_PKCS1_OAEP_PADDING: 4,
};

// Export everything
const crypto = {
  randomFillSync,
  randomBytes,
  randomUUID,
  createHash,
  createHmac,
  timingSafeEqual,
  pbkdf2,
  pbkdf2Sync,
  Hash,
  Hmac,
  constants,
  webcrypto,
};

export default crypto;
