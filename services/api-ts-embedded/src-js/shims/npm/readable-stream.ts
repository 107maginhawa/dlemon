/**
 * readable-stream shim - re-exports node stream classes.
 *
 * The readable-stream npm package is essentially a userland version of
 * Node.js streams. We just re-export our stream shim.
 */

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
  default,
} from '../node/stream';
