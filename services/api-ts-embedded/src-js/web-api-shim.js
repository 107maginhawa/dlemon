/**
 * Web API Shim for embedded JS engines (QuickJS 0.21).
 * Provides minimal Request, Response, Headers, URL, URLSearchParams,
 * TextEncoder, TextDecoder, btoa, atob, and crypto (Web Crypto API).
 *
 * Crypto operations bridge to native Rust functions:
 *   __crypto_get_random_values(length) -> number[]
 *   __crypto_random_uuid() -> string
 *   __crypto_sha256(bytes) -> number[]
 *   __crypto_hmac_sha256_sign(keyBytes, dataBytes) -> number[]
 *   __crypto_hmac_sha256_verify(keyBytes, sigBytes, dataBytes) -> boolean
 *   __crypto_sha1(bytes) -> number[]
 */
(function () {
  if (typeof globalThis.Response !== "undefined") return;

  // ── TextEncoder / TextDecoder ───────────────────────────────────
  if (typeof globalThis.TextEncoder === "undefined") {
    globalThis.TextEncoder = class TextEncoder {
      get encoding() { return "utf-8"; }
      encode(str) {
        str = String(str);
        var bytes = [];
        for (var i = 0; i < str.length; i++) {
          var c = str.charCodeAt(i);
          if (c < 0x80) {
            bytes.push(c);
          } else if (c < 0x800) {
            bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
          } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            var c2 = str.charCodeAt(++i);
            var cp = ((c - 0xd800) << 10) + (c2 - 0xdc00) + 0x10000;
            bytes.push(
              0xf0 | (cp >> 18),
              0x80 | ((cp >> 12) & 0x3f),
              0x80 | ((cp >> 6) & 0x3f),
              0x80 | (cp & 0x3f)
            );
          } else {
            bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
          }
        }
        return new Uint8Array(bytes);
      }
      encodeInto(str, dest) {
        var encoded = this.encode(str);
        var len = Math.min(encoded.length, dest.length);
        dest.set(encoded.subarray(0, len));
        return { read: str.length, written: len };
      }
    };
  }

  if (typeof globalThis.TextDecoder === "undefined") {
    globalThis.TextDecoder = class TextDecoder {
      constructor(label) { this._label = label || "utf-8"; }
      get encoding() { return this._label; }
      decode(input) {
        if (!input || input.length === 0) return "";
        var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
        var result = "";
        for (var i = 0; i < bytes.length;) {
          var b = bytes[i];
          if (b < 0x80) {
            result += String.fromCharCode(b);
            i++;
          } else if ((b & 0xe0) === 0xc0) {
            result += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
            i += 2;
          } else if ((b & 0xf0) === 0xe0) {
            result += String.fromCharCode(
              ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
            );
            i += 3;
          } else if ((b & 0xf8) === 0xf0) {
            var cp =
              ((b & 0x07) << 18) |
              ((bytes[i + 1] & 0x3f) << 12) |
              ((bytes[i + 2] & 0x3f) << 6) |
              (bytes[i + 3] & 0x3f);
            cp -= 0x10000;
            result += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
            i += 4;
          } else {
            result += "\ufffd";
            i++;
          }
        }
        return result;
      }
    };
  }

  // ── btoa / atob ─────────────────────────────────────────────────
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  if (typeof globalThis.btoa === "undefined") {
    globalThis.btoa = function btoa(str) {
      var out = "";
      for (var i = 0; i < str.length; i += 3) {
        var b1 = str.charCodeAt(i);
        var b2 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
        var b3 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
        out += B64[(b1 >> 2) & 63];
        out += B64[((b1 << 4) | (b2 >> 4)) & 63];
        out += i + 1 < str.length ? B64[((b2 << 2) | (b3 >> 6)) & 63] : "=";
        out += i + 2 < str.length ? B64[b3 & 63] : "=";
      }
      return out;
    };
  }

  if (typeof globalThis.atob === "undefined") {
    globalThis.atob = function atob(str) {
      str = str.replace(/=+$/, "");
      var out = "";
      for (var i = 0; i < str.length; i += 4) {
        var a = B64.indexOf(str[i]);
        var b = B64.indexOf(str[i + 1]);
        var c = i + 2 < str.length ? B64.indexOf(str[i + 2]) : 0;
        var d = i + 3 < str.length ? B64.indexOf(str[i + 3]) : 0;
        out += String.fromCharCode((a << 2) | (b >> 4));
        if (i + 2 < str.length) out += String.fromCharCode(((b << 4) | (c >> 2)) & 255);
        if (i + 3 < str.length) out += String.fromCharCode(((c << 6) | d) & 255);
      }
      return out;
    };
  }

  // ── crypto (Web Crypto API shim) ────────────────────────────────
  // Bridges to native Rust functions via globalThis.__crypto object.
  // Always overwrite — QuickJS may provide a partial/non-functional crypto.
  {
    var _nc = globalThis.__crypto; // native crypto object from Rust

    var _subtle = {
      digest: function digest(algorithm, data) {
        var algoName = typeof algorithm === "string" ? algorithm : algorithm.name;
        var bytes = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
        var result;
        if (algoName === "SHA-256" || algoName === "sha-256") {
          if (!_nc || !_nc.sha256) return Promise.reject(new Error("Native crypto not available"));
          result = _nc.sha256(bytes);
        } else if (algoName === "SHA-1" || algoName === "sha-1") {
          if (!_nc || !_nc.sha1) return Promise.reject(new Error("Native crypto not available"));
          result = _nc.sha1(bytes);
        } else {
          return Promise.reject(new Error("Unsupported digest algorithm: " + algoName));
        }
        return Promise.resolve(new Uint8Array(result).buffer);
      },
      importKey: function importKey(format, keyData, algorithm, extractable, usages) {
        var algoName = typeof algorithm === "string" ? algorithm : (algorithm.name || algorithm);
        var keyBytes;
        if (keyData instanceof Uint8Array) {
          keyBytes = Array.from(keyData);
        } else if (keyData instanceof ArrayBuffer) {
          keyBytes = Array.from(new Uint8Array(keyData));
        } else if (typeof keyData === "string") {
          keyBytes = Array.from(new TextEncoder().encode(keyData));
        } else {
          keyBytes = Array.from(new Uint8Array(keyData));
        }
        var key = {
          type: "secret",
          algorithm: { name: algoName },
          extractable: extractable,
          usages: usages,
          _keyData: keyBytes,
        };
        return Promise.resolve(key);
      },
      sign: function sign(algorithm, key, data) {
        var bytes = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
        if (!_nc || !_nc.hmacSha256Sign) return Promise.reject(new Error("Native crypto not available"));
        var result = _nc.hmacSha256Sign(key._keyData, bytes);
        return Promise.resolve(new Uint8Array(result).buffer);
      },
      verify: function verify(algorithm, key, signature, data) {
        var sigBytes = signature instanceof Uint8Array ? Array.from(signature) : Array.from(new Uint8Array(signature));
        var dataBytes = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
        if (!_nc || !_nc.hmacSha256Verify) return Promise.reject(new Error("Native crypto not available"));
        var result = _nc.hmacSha256Verify(key._keyData, sigBytes, dataBytes);
        return Promise.resolve(result);
      },
      exportKey: function exportKey(format, key) {
        if (format === "raw") {
          return Promise.resolve(new Uint8Array(key._keyData).buffer);
        }
        return Promise.reject(new Error("Unsupported export format: " + format));
      },
      deriveBits: function deriveBits(algorithm, baseKey, length) {
        return Promise.reject(new Error("deriveBits not implemented"));
      },
      encrypt: function encrypt(algorithm, key, data) {
        return Promise.reject(new Error("encrypt not implemented"));
      },
      decrypt: function decrypt(algorithm, key, data) {
        return Promise.reject(new Error("decrypt not implemented"));
      },
    };

    globalThis.crypto = {
      subtle: _subtle,
      getRandomValues: function getRandomValues(arr) {
        if (!_nc || !_nc.getRandomValues) throw new Error("Native crypto not available");
        var bytes = _nc.getRandomValues(arr.length);
        for (var i = 0; i < arr.length; i++) arr[i] = bytes[i];
        return arr;
      },
      randomUUID: function randomUUID() {
        if (!_nc || !_nc.randomUUID) throw new Error("Native crypto not available");
        return _nc.randomUUID();
      },
    };
  }

  // ── Blob (minimal) ──────────────────────────────────────────────
  if (typeof globalThis.Blob === "undefined") {
    globalThis.Blob = class Blob {
      constructor(parts, options) {
        this._parts = parts || [];
        this.type = (options && options.type) || "";
        var total = 0;
        for (var i = 0; i < this._parts.length; i++) {
          var p = this._parts[i];
          if (typeof p === "string") total += p.length;
          else if (p instanceof Uint8Array) total += p.length;
          else if (p instanceof ArrayBuffer) total += p.byteLength;
          else total += String(p).length;
        }
        this.size = total;
      }
      async text() {
        var result = "";
        for (var i = 0; i < this._parts.length; i++) {
          var p = this._parts[i];
          if (typeof p === "string") result += p;
          else if (p instanceof Uint8Array) result += new TextDecoder().decode(p);
          else result += String(p);
        }
        return result;
      }
      async arrayBuffer() {
        var text = await this.text();
        return new TextEncoder().encode(text).buffer;
      }
      slice(start, end, type) {
        return new Blob([this.text().then(t => t.slice(start, end))], { type: type || this.type });
      }
    };
  }

  // ── ReadableStream / WritableStream (minimal stubs) ─────────────
  if (typeof globalThis.ReadableStream === "undefined") {
    globalThis.ReadableStream = class ReadableStream {
      constructor(source) {
        this._source = source;
        this.locked = false;
      }
      getReader() {
        var self = this;
        self.locked = true;
        var done = false;
        return {
          read: function() {
            if (done) return Promise.resolve({ done: true, value: undefined });
            if (self._source && self._source.start) {
              var chunks = [];
              var controller = {
                enqueue: function(chunk) { chunks.push(chunk); },
                close: function() { done = true; },
                error: function() { done = true; },
              };
              self._source.start(controller);
              if (chunks.length > 0) {
                return Promise.resolve({ done: false, value: chunks[0] });
              }
            }
            done = true;
            return Promise.resolve({ done: true, value: undefined });
          },
          releaseLock: function() { self.locked = false; },
          cancel: function() { done = true; return Promise.resolve(); },
        };
      }
      async cancel() {}
      tee() { return [this, this]; }
      [Symbol.asyncIterator]() {
        var reader = this.getReader();
        return {
          next: function() { return reader.read(); },
          return: function() { reader.releaseLock(); return Promise.resolve({ done: true }); },
        };
      }
    };
  }

  // WritableStream and TransformStream are rarely used — lazy-init on first access
  if (typeof globalThis.WritableStream === "undefined") {
    Object.defineProperty(globalThis, "WritableStream", {
      configurable: true,
      get: function() {
        var WS = class WritableStream {
          constructor() { this.locked = false; }
          getWriter() {
            return {
              write: function() { return Promise.resolve(); },
              close: function() { return Promise.resolve(); },
              abort: function() { return Promise.resolve(); },
              releaseLock: function() {},
              get ready() { return Promise.resolve(); },
            };
          }
        };
        Object.defineProperty(globalThis, "WritableStream", { value: WS, writable: true, configurable: true });
        return WS;
      }
    });
  }

  if (typeof globalThis.TransformStream === "undefined") {
    Object.defineProperty(globalThis, "TransformStream", {
      configurable: true,
      get: function() {
        var TS = class TransformStream {
          constructor() {
            this.readable = new ReadableStream();
            this.writable = new WritableStream();
          }
        };
        Object.defineProperty(globalThis, "TransformStream", { value: TS, writable: true, configurable: true });
        return TS;
      }
    });
  }

  // ── FormData (minimal) ──────────────────────────────────────────
  if (typeof globalThis.FormData === "undefined") {
    globalThis.FormData = class FormData {
      constructor() { this._data = new Map(); }
      get(k) { return this._data.has(k) ? this._data.get(k) : null; }
      has(k) { return this._data.has(k); }
      set(k, v) { this._data.set(k, v); }
      append(k, v) { this._data.set(k, v); }
      delete(k) { this._data.delete(k); }
      entries() { return this._data.entries(); }
      keys() { return this._data.keys(); }
      values() { return this._data.values(); }
      forEach(cb) { this._data.forEach(function(v, k) { cb(v, k, this); }.bind(this)); }
    };
    FormData.prototype[Symbol.iterator] = function () { return this._data[Symbol.iterator](); };
  }

  // ── AbortController / AbortSignal (stub) ──────────────────────
  if (typeof globalThis.AbortController === "undefined") {
    globalThis.AbortSignal = class AbortSignal {
      constructor() { this.aborted = false; this.reason = undefined; }
      static timeout(ms) { return new AbortSignal(); }
      addEventListener() {}
      removeEventListener() {}
    };
    globalThis.AbortController = class AbortController {
      constructor() { this.signal = new AbortSignal(); }
      abort(reason) { this.signal.aborted = true; this.signal.reason = reason; }
    };
  }

  // ── Event / EventTarget (minimal) ─────────────────────────────
  if (typeof globalThis.Event === "undefined") {
    globalThis.Event = class Event {
      constructor(type, options) {
        this.type = type;
        this.bubbles = (options && options.bubbles) || false;
        this.cancelable = (options && options.cancelable) || false;
        this.defaultPrevented = false;
      }
      preventDefault() { this.defaultPrevented = true; }
      stopPropagation() {}
    };
  }

  // ── setTimeout / clearTimeout (synchronous stubs) ─────────────
  if (typeof globalThis.setTimeout === "undefined") {
    globalThis.setTimeout = function(fn, ms) {
      // Execute immediately in synchronous engine
      if (typeof fn === "function") fn();
      return 0;
    };
    globalThis.clearTimeout = function() {};
    globalThis.setInterval = function() { return 0; };
    globalThis.clearInterval = function() {};
  }

  // ── queueMicrotask ────────────────────────────────────────────
  if (typeof globalThis.queueMicrotask === "undefined") {
    globalThis.queueMicrotask = function(fn) {
      Promise.resolve().then(fn);
    };
  }

  // ── structuredClone ──────────────────────────────────────────
  if (typeof globalThis.structuredClone === "undefined") {
    globalThis.structuredClone = function(obj) {
      if (obj === null || typeof obj !== "object") return obj;
      return JSON.parse(JSON.stringify(obj));
    };
  }

  // ── AsyncLocalStorage (override for async-safe behavior) ───
  // unenv's AsyncLocalStorage clears the store after run() returns,
  // but in QuickJS the callback is async and the store is needed during
  // Promise resolution. We keep the store set until the next run().
  globalThis.AsyncLocalStorage = class AsyncLocalStorage {
    constructor() {
      this._store = undefined;
    }
    getStore() {
      return this._store;
    }
    run(store, callback) {
      var prev = this._store;
      this._store = store;
      try {
        var args = [];
        for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
        return callback.apply(undefined, args);
      } catch(e) {
        this._store = prev;
        throw e;
      }
      // Note: intentionally NOT clearing _store for async callbacks
    }
    exit(callback) {
      var prev = this._store;
      this._store = undefined;
      try {
        var args = [];
        for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
        return callback.apply(undefined, args);
      } finally {
        this._store = prev;
      }
    }
    enterWith(store) {
      this._store = store;
    }
    disable() {}
    enable() {}
    static snapshot() {
      throw new Error("AsyncLocalStorage.snapshot not implemented");
    }
  };

  // ── URLSearchParams ─────────────────────────────────────────────
  class URLSearchParams {
    constructor(init) {
      this._p = new Map();
      if (typeof init === "string") {
        var s = init.startsWith("?") ? init.slice(1) : init;
        for (var pair of s.split("&")) {
          if (!pair) continue;
          var eq = pair.indexOf("=");
          var k = eq === -1 ? pair : pair.slice(0, eq);
          var v = eq === -1 ? "" : pair.slice(eq + 1);
          this._p.set(decodeURIComponent(k), decodeURIComponent(v));
        }
      } else if (init && typeof init === "object") {
        for (var [k2, v2] of Object.entries(init)) this._p.set(k2, String(v2));
      }
    }
    get(k) { return this._p.has(k) ? this._p.get(k) : null; }
    has(k) { return this._p.has(k); }
    set(k, v) { this._p.set(k, String(v)); }
    delete(k) { this._p.delete(k); }
    append(k, v) {
      var key = k;
      var cur = this._p.get(key);
      this._p.set(key, cur ? cur + "," + v : String(v));
    }
    toString() {
      var parts = [];
      this._p.forEach(function(v, k) { parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); });
      return parts.join("&");
    }
    forEach(cb) { this._p.forEach(function(v, k, m) { cb(v, k, this); }.bind(this)); }
    entries() { return this._p.entries(); }
    keys() { return this._p.keys(); }
    values() { return this._p.values(); }
  }
  URLSearchParams.prototype[Symbol.iterator] = function () { return this._p[Symbol.iterator](); };

  class URL {
    constructor(url, base) {
      if (base && !url.match(/^https?:\/\//)) {
        url = base.replace(/\/+$/, "") + (url.startsWith("/") ? "" : "/") + url;
      }
      var m = url.match(/^(https?):\/\/([^/?#]*)(\/[^?#]*)?\??([^#]*)#?(.*)$/);
      if (!m) throw new TypeError("Invalid URL: " + url);
      this.protocol = m[1] + ":";
      this.host = m[2];
      this.hostname = m[2].split(":")[0];
      this.port = (m[2].split(":")[1]) || "";
      this.pathname = m[3] || "/";
      this.search = m[4] ? "?" + m[4] : "";
      this.hash = m[5] ? "#" + m[5] : "";
      this.searchParams = new URLSearchParams(m[4] || "");
      this.origin = this.protocol + "//" + this.host;
      this.href = this.origin + this.pathname + this.search + this.hash;
    }
    toString() { return this.href; }
  }

  class Headers {
    constructor(init) {
      this._h = new Map();
      if (init instanceof Headers) {
        init.forEach(function(v, k) { this._h.set(k, v); }.bind(this));
      } else if (Array.isArray(init)) {
        for (var _i = 0; _i < init.length; _i++) {
          var pair = init[_i];
          this._h.set(pair[0].toLowerCase(), String(pair[1]));
        }
      } else if (init && typeof init === "object") {
        for (var [k, v] of Object.entries(init)) this._h.set(k.toLowerCase(), String(v));
      }
    }
    get(k) { return this._h.get(k.toLowerCase()) || null; }
    set(k, v) { this._h.set(k.toLowerCase(), String(v)); }
    has(k) { return this._h.has(k.toLowerCase()); }
    delete(k) { this._h.delete(k.toLowerCase()); }
    append(k, v) {
      var key = k.toLowerCase();
      var cur = this._h.get(key);
      this._h.set(key, cur ? cur + ", " + v : String(v));
    }
    forEach(cb) { this._h.forEach(function(v, k) { cb(v, k, this); }.bind(this)); }
    entries() { return this._h.entries(); }
    keys() { return this._h.keys(); }
    values() { return this._h.values(); }
    getSetCookie() {
      var cookies = [];
      var val = this._h.get("set-cookie");
      if (val) cookies.push(val);
      return cookies;
    }
  }
  Headers.prototype[Symbol.iterator] = function () { return this._h[Symbol.iterator](); };

  class Request {
    constructor(input, init) {
      init = init || {};
      if (input instanceof Request) {
        this.url = input.url;
        this.method = input.method;
        this.headers = new Headers(input.headers);
        this._body = input._body;
      } else {
        this.url = String(input);
        this.method = (init.method || "GET").toUpperCase();
        this.headers = new Headers(init.headers);
        this._body = init.body !== undefined ? init.body : null;
      }
      this.body = this._body != null ? true : null;
      this.bodyUsed = false;
      this.credentials = init.credentials || "same-origin";
      this.mode = init.mode || "cors";
      this.cache = init.cache || "default";
      this.redirect = init.redirect || "follow";
      this.referrer = init.referrer || "";
      this.signal = init.signal || null;
    }
    async json() {
      if (!this._body) return null;
      return typeof this._body === "string" ? JSON.parse(this._body) : this._body;
    }
    async text() {
      if (!this._body) return "";
      return typeof this._body === "string" ? this._body : JSON.stringify(this._body);
    }
    async formData() {
      var text = await this.text();
      var fd = { _data: new Map() };
      fd.get = function(k) { return fd._data.get(k) || null; };
      fd.has = function(k) { return fd._data.has(k); };
      fd.set = function(k, v) { fd._data.set(k, v); };
      if (text) {
        var pairs = text.split("&");
        for (var i = 0; i < pairs.length; i++) {
          var eq = pairs[i].indexOf("=");
          if (eq !== -1) {
            fd._data.set(decodeURIComponent(pairs[i].slice(0, eq)), decodeURIComponent(pairs[i].slice(eq + 1)));
          }
        }
      }
      return fd;
    }
    async arrayBuffer() { return new ArrayBuffer(0); }
    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this._body,
        credentials: this.credentials,
      });
    }
  }

  class Response {
    constructor(body, init) {
      init = init || {};

      // CRITICAL FIX: Handle case where init is actually a Response object
      // Hono passes Response objects as init when finalizing responses
      // e.g., new Response(null, existingResponse)
      if (init instanceof Response || init._body !== undefined) {
        var sourceResponse = init;
        if (body === null || body === undefined) {
          body = sourceResponse._body;
        }
        init = {
          status: sourceResponse.status,
          statusText: sourceResponse.statusText,
          headers: sourceResponse.headers
        };
      }

      this._body = body === null || body === undefined ? null : body;
      this.status = init.status !== undefined ? init.status : 200;
      this.statusText = init.statusText || "";
      this.headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
      this.ok = this.status >= 200 && this.status < 300;
      this.type = "basic";
      this.url = init.url || "";
      this.redirected = false;
      this.bodyUsed = false;
    }
    async json() {
      if (this._body === null) return null;
      this.bodyUsed = true;
      return typeof this._body === "string" ? JSON.parse(this._body) : this._body;
    }
    async text() {
      if (this._body === null) return "";
      this.bodyUsed = true;
      return typeof this._body === "string" ? this._body : JSON.stringify(this._body);
    }
    async arrayBuffer() { return new ArrayBuffer(0); }
    clone() {
      return new Response(this._body, { status: this.status, statusText: this.statusText, headers: this.headers });
    }
    static json(data, init) {
      init = init || {};
      var body = JSON.stringify(data);
      var h = new Headers(init.headers);
      h.set("content-type", "application/json");
      return new Response(body, { status: init.status || 200, statusText: init.statusText || "", headers: h });
    }
    static redirect(url, status) {
      var h = new Headers();
      h.set("location", url);
      return new Response(null, { status: status || 302, headers: h });
    }
  }

  globalThis.URL = URL;
  globalThis.URLSearchParams = URLSearchParams;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;

  // ── fetch polyfill (minimal, for internal sub-requests) ───────────
  // ── process global (some CJS modules access process directly) ──
  if (typeof globalThis.process === "undefined") {
    globalThis.process = {
      env: {},
      versions: {},
      version: "v0.0.0",
      platform: "linux",
      argv: [],
      cwd: function() { return "/"; },
      exit: function() {},
      nextTick: function(fn) { Promise.resolve().then(fn); },
      stdout: { write: function() {} },
      stderr: { write: function() {} },
      stdin: undefined,
      pid: 1,
      hrtime: { bigint: function() { return BigInt(0); } },
      on: function() { return globalThis.process; },
      removeListener: function() { return globalThis.process; },
      emitWarning: function() {},
    };
  }

  // ── escape/unescape (deprecated but still used by some packages) ──
  if (typeof globalThis.escape === "undefined") {
    globalThis.escape = function (str) { return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p) { return String.fromCharCode(parseInt(p, 16)); }); };
    globalThis.unescape = function (str) { return decodeURIComponent(str); };
  }

  if (typeof globalThis.fetch === "undefined") {
    globalThis.fetch = async function fetch(input, init) {
      console.warn("[fetch stub] fetch called but not available in embedded mode:", typeof input === "string" ? input : input?.url);
      return new Response(JSON.stringify({ error: "fetch not available in embedded mode" }), {
        status: 503,
        headers: new Headers({ "content-type": "application/json" }),
      });
    };
  }

  // ── Buffer polyfill (minimal, for Node.js compat) ─────────────────
  if (typeof globalThis.Buffer === "undefined") {
    var encoder = new TextEncoder();
    var decoder = new TextDecoder();

    function Buffer(data) {
      if (data instanceof Uint8Array) {
        this._bytes = data;
      } else if (typeof data === "string") {
        this._bytes = encoder.encode(data);
      } else if (Array.isArray(data)) {
        this._bytes = new Uint8Array(data);
      } else {
        this._bytes = new Uint8Array(0);
      }
      this.length = this._bytes.length;
      // Copy bytes to allow array-like access (buffer[i])
      for (var i = 0; i < this._bytes.length; i++) {
        this[i] = this._bytes[i];
      }
    }

    Buffer.from = function (input, encoding) {
      if (input instanceof Uint8Array || input instanceof Buffer) {
        return new Buffer(input instanceof Buffer ? input._bytes : input);
      }
      if (typeof input === "string") {
        if (encoding === "base64") {
          var binary = atob(input);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new Buffer(bytes);
        }
        if (encoding === "hex") {
          var bytes = new Uint8Array(input.length / 2);
          for (var i = 0; i < input.length; i += 2) {
            bytes[i / 2] = parseInt(input.substring(i, i + 2), 16);
          }
          return new Buffer(bytes);
        }
        return new Buffer(input);
      }
      if (Array.isArray(input)) return new Buffer(input);
      return new Buffer(new Uint8Array(0));
    };

    Buffer.alloc = function (size, fill) {
      var arr = new Uint8Array(size);
      if (fill !== undefined) arr.fill(typeof fill === "number" ? fill : 0);
      return new Buffer(arr);
    };

    Buffer.allocUnsafe = function (size) {
      // Same as alloc but without zero-filling (perf optimization in Node)
      // In our polyfill we just return uninitialized memory anyway
      return new Buffer(new Uint8Array(size));
    };

    Buffer.isBuffer = function (obj) {
      return obj instanceof Buffer;
    };

    Buffer.concat = function (list, totalLength) {
      if (!totalLength) totalLength = list.reduce(function (sum, b) { return sum + (b._bytes || b).length; }, 0);
      var result = new Uint8Array(totalLength);
      var offset = 0;
      for (var i = 0; i < list.length; i++) {
        var bytes = list[i]._bytes || list[i];
        result.set(bytes, offset);
        offset += bytes.length;
      }
      return new Buffer(result);
    };

    Buffer.prototype.toString = function (encoding) {
      if (encoding === "base64") {
        var binary = "";
        for (var i = 0; i < this._bytes.length; i++) binary += String.fromCharCode(this._bytes[i]);
        return btoa(binary);
      }
      if (encoding === "hex") {
        var hex = "";
        for (var i = 0; i < this._bytes.length; i++) hex += this._bytes[i].toString(16).padStart(2, "0");
        return hex;
      }
      return decoder.decode(this._bytes);
    };

    Buffer.prototype.slice = function (start, end) {
      return new Buffer(this._bytes.slice(start, end));
    };

    Buffer.prototype.copy = function (target, targetStart, sourceStart, sourceEnd) {
      var src = this._bytes.slice(sourceStart || 0, sourceEnd || this._bytes.length);
      (target._bytes || target).set(src, targetStart || 0);
    };

    Buffer.prototype.readUInt8 = function (offset) { return this._bytes[offset]; };
    Buffer.prototype.writeUInt8 = function (value, offset) { this._bytes[offset] = value; };

    Buffer.byteLength = function (str, encoding) {
      if (encoding === "base64") return Math.ceil(str.length * 3 / 4);
      return encoder.encode(str).length;
    };

    globalThis.Buffer = Buffer;
  }

  // ── Intl polyfill (minimal, for date-fns-tz) ─────────────────────
  if (typeof globalThis.Intl === "undefined") {
    globalThis.Intl = {
      DateTimeFormat: function (locale, options) {
        this._locale = locale || "en-US";
        this._options = options || {};
        this.format = function (date) {
          if (!date) return "";
          return date.toISOString ? date.toISOString() : String(date);
        };
        this.formatToParts = function (date) {
          if (!date) return [];
          var d = date instanceof Date ? date : new Date(date);
          return [
            { type: "year", value: String(d.getUTCFullYear()) },
            { type: "literal", value: "-" },
            { type: "month", value: String(d.getUTCMonth() + 1).padStart(2, "0") },
            { type: "literal", value: "-" },
            { type: "day", value: String(d.getUTCDate()).padStart(2, "0") },
            { type: "literal", value: "T" },
            { type: "hour", value: String(d.getUTCHours()).padStart(2, "0") },
            { type: "literal", value: ":" },
            { type: "minute", value: String(d.getUTCMinutes()).padStart(2, "0") },
            { type: "literal", value: ":" },
            { type: "second", value: String(d.getUTCSeconds()).padStart(2, "0") },
          ];
        };
        this.resolvedOptions = function () {
          return { timeZone: this._options.timeZone || "UTC", locale: this._locale };
        };
      },
      getCanonicalLocales: function (locales) {
        return Array.isArray(locales) ? locales : [locales || "en-US"];
      },
    };
  }
})();
