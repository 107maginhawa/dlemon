/**
 * @google-cloud/storage shim - GCS not available in embedded mode.
 */

class File {
  name: string;
  bucket: Bucket;

  constructor(bucket: Bucket, name: string) {
    this.bucket = bucket;
    this.name = name;
  }

  async save(_data: any, _options?: any) {
    console.warn('[gcs] GCS operations not available in embedded mode');
  }

  async download(_options?: any): Promise<[Buffer]> {
    throw new Error('GCS not available in embedded mode');
  }

  async delete(_options?: any) {}
  async exists(): Promise<[boolean]> { return [false]; }
  async getMetadata(): Promise<[any]> { return [{}]; }
  async setMetadata(_metadata: any) {}
  createReadStream(_options?: any) { return null; }
  createWriteStream(_options?: any) { return null; }
}

class Bucket {
  name: string;
  storage: Storage;

  constructor(storage: Storage, name: string) {
    this.storage = storage;
    this.name = name;
  }

  file(name: string): File {
    return new File(this, name);
  }

  async exists(): Promise<[boolean]> { return [false]; }
  async create(_options?: any) {}
  async delete(_options?: any) {}
  async getFiles(_options?: any): Promise<[File[]]> { return [[]]; }
  async upload(_pathString: string, _options?: any): Promise<[File]> {
    throw new Error('GCS not available in embedded mode');
  }
}

class Storage {
  projectId?: string;

  constructor(_options?: any) {}

  bucket(name: string): Bucket {
    return new Bucket(this, name);
  }

  async getBuckets(): Promise<[Bucket[]]> { return [[]]; }
  async createBucket(_name: string, _options?: any): Promise<[Bucket]> {
    throw new Error('GCS not available in embedded mode');
  }
}

export { Storage, Bucket, File };
export default Storage;
