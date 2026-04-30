/**
 * through2 shim - simple transform stream factory.
 */
import { Transform, PassThrough } from '../node/stream';

function through2(opts?: any, transform?: Function, flush?: Function) {
  if (typeof opts === 'function') {
    flush = transform;
    transform = opts;
    opts = {};
  }

  const stream = new (Transform as any)(opts);

  if (transform) {
    stream._transform = function(chunk: any, enc: string, cb: Function) {
      transform.call(this, chunk, enc, cb);
    };
  }

  if (flush) {
    stream._flush = function(cb: Function) {
      flush.call(this, cb);
    };
  }

  return stream;
}

through2.obj = function(opts?: any, transform?: Function, flush?: Function) {
  if (typeof opts === 'function') {
    flush = transform;
    transform = opts;
    opts = {};
  }
  opts = opts || {};
  opts.objectMode = true;
  return through2(opts, transform, flush);
};

through2.ctor = function(_opts?: any, _transform?: Function, _flush?: Function) {
  return Transform;
};

export default through2;
export { through2 };
