/**
 * readable-stream/passthrough shim.
 *
 * Packages like lazystream do:
 *   var PassThrough = require('readable-stream/passthrough');
 *
 * They expect to get the PassThrough constructor directly.
 */
import { PassThrough } from '../node/stream';
export = PassThrough;
