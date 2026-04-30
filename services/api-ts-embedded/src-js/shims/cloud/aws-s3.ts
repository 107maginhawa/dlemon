/**
 * @aws-sdk/client-s3 shim - S3 not available in embedded mode.
 */
import { Client, Command, ServiceException } from './smithy';

// S3Client extends the base Smithy Client
class S3Client extends Client {
  constructor(config?: any) {
    super(config);
  }

  async send(command: any, _options?: any): Promise<any> {
    console.warn('[aws-s3] S3 operations not available in embedded mode');
    return { $metadata: { httpStatusCode: 200 } };
  }
}

// S3 Commands
class PutObjectCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class GetObjectCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class DeleteObjectCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class HeadBucketCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class CreateBucketCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class ListObjectsV2Command extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class CopyObjectCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

class HeadObjectCommand extends Command {
  constructor(input?: any) {
    super(input);
  }
}

// S3 Exceptions
class NoSuchKey extends ServiceException {
  constructor() {
    super({ name: 'NoSuchKey', $fault: 'client' });
  }
}

class NoSuchBucket extends ServiceException {
  constructor() {
    super({ name: 'NoSuchBucket', $fault: 'client' });
  }
}

// Export type for config
interface S3ClientConfig {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoint?: string;
  forcePathStyle?: boolean;
}

export {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NoSuchBucket,
};

export default {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NoSuchBucket,
};
