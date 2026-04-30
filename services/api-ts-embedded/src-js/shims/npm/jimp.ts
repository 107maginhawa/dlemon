/**
 * Jimp shim - image processing not available in embedded mode.
 * Storage service doesn't need image manipulation offline.
 */

const MIME_PNG = 'image/png';
const MIME_JPEG = 'image/jpeg';
const MIME_BMP = 'image/bmp';
const MIME_GIF = 'image/gif';
const MIME_TIFF = 'image/tiff';
const AUTO = 'image/png';

class Jimp {
  bitmap = { data: null, width: 0, height: 0 };

  constructor() {
    console.warn('[jimp] Image processing not available in embedded mode');
  }

  static MIME_PNG = MIME_PNG;
  static MIME_JPEG = MIME_JPEG;
  static MIME_BMP = MIME_BMP;
  static MIME_GIF = MIME_GIF;
  static MIME_TIFF = MIME_TIFF;
  static AUTO = AUTO;

  static async read(_input: any): Promise<Jimp> {
    console.warn('[jimp] Image read not available in embedded mode');
    return new Jimp();
  }

  resize(_w: number, _h: number): this {
    return this;
  }

  quality(_q: number): this {
    return this;
  }

  blur(_r: number): this {
    return this;
  }

  greyscale(): this {
    return this;
  }

  crop(_x: number, _y: number, _w: number, _h: number): this {
    return this;
  }

  rotate(_deg: number): this {
    return this;
  }

  flip(_horizontal: boolean, _vertical: boolean): this {
    return this;
  }

  getWidth(): number {
    return 0;
  }

  getHeight(): number {
    return 0;
  }

  getMIME(): string {
    return MIME_PNG;
  }

  getExtension(): string {
    return 'png';
  }

  async getBufferAsync(_mime: string): Promise<Buffer> {
    return Buffer.alloc(0);
  }

  async writeAsync(_path: string): Promise<this> {
    return this;
  }

  clone(): Jimp {
    return new Jimp();
  }
}

// Static method that returns Promise<Jimp>
const jimp = Object.assign(Jimp.read.bind(Jimp), {
  read: Jimp.read,
  MIME_PNG,
  MIME_JPEG,
  MIME_BMP,
  MIME_GIF,
  MIME_TIFF,
  AUTO,
  Jimp,
});

export default jimp;
export { Jimp, MIME_PNG, MIME_JPEG, MIME_BMP, MIME_GIF, MIME_TIFF, AUTO };
