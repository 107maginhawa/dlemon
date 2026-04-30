/**
 * bcryptjs shim.
 *
 * Delegates to the native __bcrypt functions provided by the Rust host.
 * The native implementation uses the `bcrypt` crate for correct password hashing.
 */

const __bcrypt = (globalThis as any).__bcrypt;

if (!__bcrypt) {
  console.warn("[bcryptjs:shim] __bcrypt not found, password operations will fail");
}

/**
 * Hash a password with bcrypt
 * @param password - Plain text password
 * @param saltRounds - Number of salt rounds (default: 10, ignored in shim)
 */
async function hash(password: string, saltRounds?: number | string): Promise<string> {
  if (!__bcrypt?.hash) {
    throw new Error("__bcrypt.hash not available");
  }
  return __bcrypt.hash(password);
}

/**
 * Synchronous hash (used by some libraries)
 */
function hashSync(password: string, saltRounds?: number | string): string {
  if (!__bcrypt?.hash) {
    throw new Error("__bcrypt.hash not available");
  }
  return __bcrypt.hash(password);
}

/**
 * Compare a password with a hash
 * @param password - Plain text password
 * @param hash - Bcrypt hash to compare against
 */
async function compare(password: string, hash: string): Promise<boolean> {
  if (!__bcrypt?.verify) {
    throw new Error("__bcrypt.verify not available");
  }
  return __bcrypt.verify(password, hash);
}

/**
 * Synchronous compare (used by some libraries)
 */
function compareSync(password: string, hash: string): boolean {
  if (!__bcrypt?.verify) {
    throw new Error("__bcrypt.verify not available");
  }
  return __bcrypt.verify(password, hash);
}

/**
 * Generate a salt (returns a dummy value since native bcrypt handles this)
 */
async function genSalt(rounds?: number): Promise<string> {
  return "$2a$10$" + "0".repeat(22);
}

/**
 * Synchronous genSalt
 */
function genSaltSync(rounds?: number): string {
  return "$2a$10$" + "0".repeat(22);
}

/**
 * Get the number of rounds from a hash
 */
function getRounds(hash: string): number {
  const match = hash.match(/^\$2[aby]?\$(\d+)\$/);
  return match ? parseInt(match[1], 10) : 10;
}

const bcrypt = {
  hash,
  hashSync,
  compare,
  compareSync,
  genSalt,
  genSaltSync,
  getRounds,
};

export default bcrypt;
export { hash, hashSync, compare, compareSync, genSalt, genSaltSync, getRounds };
