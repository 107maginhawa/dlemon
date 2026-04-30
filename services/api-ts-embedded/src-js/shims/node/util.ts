/**
 * Node.js util module shim for QuickJS engine.
 *
 * CRITICAL: `inherits()` must work correctly because many npm packages
 * use it for prototype inheritance (e.g., lazystream, through2).
 */

// inherits - sets up prototype chain for constructor inheritance
function inherits(ctor: any, superCtor: any) {
  // Be lenient with invalid inputs - some packages call inherits incorrectly
  if (ctor === undefined || ctor === null) {
    console.warn('[util.inherits] ctor is null/undefined, skipping');
    return;
  }
  if (superCtor === undefined || superCtor === null) {
    console.warn('[util.inherits] superCtor is null/undefined, skipping');
    return;
  }
  if (superCtor.prototype === undefined) {
    // Some stubs don't have prototypes - create an empty one
    superCtor.prototype = {};
  }
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  });
}

// promisify - wraps callback-style function in Promise
function promisify<T extends (...args: any[]) => any>(fn: T): (...args: any[]) => Promise<any> {
  return function(...args: any[]) {
    return new Promise((resolve, reject) => {
      fn(...args, (err: Error | null, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
}

// callbackify - wraps Promise-returning function with callback
function callbackify<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return function(...args: any[]) {
    const cb = args.pop();
    fn(...args)
      .then((result: any) => cb(null, result))
      .catch((err: Error) => cb(err));
  };
}

// deprecate - returns function with deprecation warning
function deprecate<T extends Function>(fn: T, msg: string): T {
  let warned = false;
  return function(this: any, ...args: any[]) {
    if (!warned) {
      console.warn('DeprecationWarning:', msg);
      warned = true;
    }
    return fn.apply(this, args);
  } as any;
}

// format - simple printf-style formatting
function format(fmt: any, ...args: any[]): string {
  if (typeof fmt !== 'string') {
    return [fmt, ...args].map(inspect).join(' ');
  }
  let i = 0;
  return fmt.replace(/%[sdjifoO%]/g, (match) => {
    if (match === '%%') return '%';
    if (i >= args.length) return match;
    const arg = args[i++];
    switch (match) {
      case '%s': return String(arg);
      case '%d': case '%i': return parseInt(arg, 10).toString();
      case '%f': return parseFloat(arg).toString();
      case '%j': return JSON.stringify(arg);
      case '%o': case '%O': return inspect(arg);
      default: return match;
    }
  });
}

// inspect - convert value to string representation
function inspect(obj: any, _opts?: any): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'string') return `'${obj}'`;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'function') return `[Function: ${obj.name || 'anonymous'}]`;
  if (Array.isArray(obj)) return `[ ${obj.map(inspect).join(', ')} ]`;
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[object Object]';
    }
  }
  return String(obj);
}

// Type checking functions
function isArray(arg: any): arg is any[] { return Array.isArray(arg); }
function isBoolean(arg: any): arg is boolean { return typeof arg === 'boolean'; }
function isNull(arg: any): arg is null { return arg === null; }
function isNullOrUndefined(arg: any): arg is null | undefined { return arg == null; }
function isNumber(arg: any): arg is number { return typeof arg === 'number'; }
function isString(arg: any): arg is string { return typeof arg === 'string'; }
function isSymbol(arg: any): arg is symbol { return typeof arg === 'symbol'; }
function isUndefined(arg: any): arg is undefined { return arg === undefined; }
function isRegExp(arg: any): arg is RegExp { return arg instanceof RegExp; }
function isObject(arg: any): arg is object { return typeof arg === 'object' && arg !== null; }
function isDate(arg: any): arg is Date { return arg instanceof Date; }
function isError(arg: any): arg is Error { return arg instanceof Error; }
function isFunction(arg: any): arg is Function { return typeof arg === 'function'; }
function isPrimitive(arg: any): boolean {
  return arg === null || (typeof arg !== 'object' && typeof arg !== 'function');
}
function isBuffer(arg: any): boolean {
  return arg instanceof (globalThis as any).Buffer;
}

// debuglog - returns debug logging function
function debuglog(_section: string) {
  return function(..._args: any[]) {};
}

// TextEncoder/TextDecoder - use global versions
const TextEncoder = (globalThis as any).TextEncoder;
const TextDecoder = (globalThis as any).TextDecoder;

// types namespace
const types = {
  isAnyArrayBuffer: (v: any) => v instanceof ArrayBuffer || v instanceof SharedArrayBuffer,
  isArrayBuffer: (v: any) => v instanceof ArrayBuffer,
  isArrayBufferView: (v: any) => ArrayBuffer.isView(v),
  isBigInt64Array: (v: any) => v instanceof BigInt64Array,
  isBigUint64Array: (v: any) => v instanceof BigUint64Array,
  isDataView: (v: any) => v instanceof DataView,
  isDate,
  isFloat32Array: (v: any) => v instanceof Float32Array,
  isFloat64Array: (v: any) => v instanceof Float64Array,
  isInt8Array: (v: any) => v instanceof Int8Array,
  isInt16Array: (v: any) => v instanceof Int16Array,
  isInt32Array: (v: any) => v instanceof Int32Array,
  isMap: (v: any) => v instanceof Map,
  isMapIterator: (_v: any) => false,
  isPromise: (v: any) => v instanceof Promise,
  isRegExp,
  isSet: (v: any) => v instanceof Set,
  isSetIterator: (_v: any) => false,
  isSharedArrayBuffer: (v: any) => v instanceof SharedArrayBuffer,
  isTypedArray: (v: any) => ArrayBuffer.isView(v) && !(v instanceof DataView),
  isUint8Array: (v: any) => v instanceof Uint8Array,
  isUint8ClampedArray: (v: any) => v instanceof Uint8ClampedArray,
  isUint16Array: (v: any) => v instanceof Uint16Array,
  isUint32Array: (v: any) => v instanceof Uint32Array,
  isWeakMap: (v: any) => v instanceof WeakMap,
  isWeakSet: (v: any) => v instanceof WeakSet,
};

const util = {
  inherits,
  promisify,
  callbackify,
  deprecate,
  format,
  inspect,
  debuglog,
  isArray,
  isBoolean,
  isNull,
  isNullOrUndefined,
  isNumber,
  isString,
  isSymbol,
  isUndefined,
  isRegExp,
  isObject,
  isDate,
  isError,
  isFunction,
  isPrimitive,
  isBuffer,
  TextEncoder,
  TextDecoder,
  types,
};

export {
  inherits,
  promisify,
  callbackify,
  deprecate,
  format,
  inspect,
  debuglog,
  isArray,
  isBoolean,
  isNull,
  isNullOrUndefined,
  isNumber,
  isString,
  isSymbol,
  isUndefined,
  isRegExp,
  isObject,
  isDate,
  isError,
  isFunction,
  isPrimitive,
  isBuffer,
  TextEncoder,
  TextDecoder,
  types,
};
export default util;
