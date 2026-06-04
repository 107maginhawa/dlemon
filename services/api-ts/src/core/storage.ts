/**
 * Storage provider abstraction for S3 and MinIO
 * Handles file upload/download with presigned URLs
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Logger } from '@/types/logger';

/**
 * Storage configuration for S3/MinIO
 */
export interface StorageConfig {
  provider: 'minio' | 's3';
  endpoint?: string;
  publicEndpoint?: string; // External-facing endpoint for presigned URLs
  bucket: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  uploadUrlExpiry: number;
  downloadUrlExpiry: number;
  // P2-7: per-class upload size ceilings (bytes). Ordinary images stay at the
  // default cap; `application/dicom` (CBCT volumes are 100 MB – multiple GB) gets
  // a higher, env-configurable cap bounded by an absolute hard cap to limit abuse.
  maxFileSizeBytes: number;
  dicomMaxFileSizeBytes: number;
  absoluteMaxFileSizeBytes: number;
}

/**
 * P2-7: resolve the upload size ceiling for a given MIME type. `application/dicom`
 * uses the higher CBCT cap; everything else uses the default image cap. The result
 * is clamped to the absolute hard cap so a misconfigured env can never disable the
 * abuse bound.
 */
export function maxUploadSizeForMime(config: StorageConfig, mimeType: string | undefined): number {
  const cap = mimeType === 'application/dicom' ? config.dicomMaxFileSizeBytes : config.maxFileSizeBytes;
  return Math.min(cap, config.absoluteMaxFileSizeBytes);
}

/** Human-readable byte size for error messages (e.g. "2 GB", "100 MB"). */
export function formatByteCeiling(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export interface StorageProvider {
  generateUploadUrl(fileId: string, mimeType: string): Promise<string>;
  generateDownloadUrl(fileId: string): Promise<string>;
  deleteFile(fileId: string): Promise<void>;
  verifyFileExists(fileId: string): Promise<boolean>;
  initializeBucket(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // Multipart upload methods
  initiateMultipartUpload(fileId: string, filename: string, mimeType: string): Promise<string>;
  generatePartUploadUrl(fileId: string, uploadId: string, partNumber: number): Promise<string>;
  completeMultipartUpload(
    fileId: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void>;
  abortMultipartUpload(fileId: string, uploadId: string): Promise<void>;
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private publicClient: S3Client; // Client for generating public URLs
  private config: StorageConfig;
  private logger?: Logger;
  private bucketInitialized = false;

  constructor(config: StorageConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;

    // Configure S3 client based on provider
    const clientConfig: S3ClientConfig = {
      region: config.region || 'us-east-1', // Default region for MinIO
      credentials: config.credentials,
    };

    // Add endpoint for MinIO or custom S3-compatible storage
    if (config.provider === 'minio' && config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = true; // Required for MinIO
    }

    this.client = new S3Client(clientConfig);

    // Create separate client for public URLs if publicEndpoint is configured
    if (config.publicEndpoint) {
      const publicClientConfig: S3ClientConfig = {
        region: config.region || 'us-east-1',
        credentials: config.credentials,
        endpoint: config.publicEndpoint,
        forcePathStyle: config.provider === 'minio',
      };
      this.publicClient = new S3Client(publicClientConfig);
    } else {
      this.publicClient = this.client; // Use same client if no public endpoint
    }
  }

  /**
   * Ensure bucket exists (lazy initialization)
   * Called before operations that require the bucket
   */
  private async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) {
      return;
    }

    await this.initializeBucket();
    this.bucketInitialized = true;
  }

  /**
   * Server-side-encryption params, applied ONLY for real S3. MinIO (dev/offline
   * storage) has no SSE backend and returns 501 NotImplemented ("Server side
   * encryption specified but KMS is not configured") on CreateMultipartUpload, and
   * 400 on presigned single-PUTs whose signed headers include x-amz-server-side-
   * encryption. Production uses provider 's3', so at-rest SSE is unchanged there.
   */
  private get sseParams(): { ServerSideEncryption: 'AES256' } | Record<string, never> {
    return this.config.provider === 's3' ? { ServerSideEncryption: 'AES256' } : {};
  }

  /**
   * Generate presigned URL for file upload
   */
  async generateUploadUrl(fileId: string, mimeType: string): Promise<string> {
    await this.ensureBucketExists();
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: fileId,
      ContentType: mimeType,
      ...this.sseParams,
    });

    // Use publicClient for generating URLs accessible from outside Docker network
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: this.config.uploadUrlExpiry,
    });

    this.logger?.debug({ fileId, mimeType }, 'Generated upload URL');
    return url;
  }

  /**
   * Generate presigned URL for file download
   */
  async generateDownloadUrl(fileId: string): Promise<string> {
    await this.ensureBucketExists();
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: fileId,
    });

    // Use publicClient for generating URLs accessible from outside Docker network
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: this.config.downloadUrlExpiry,
    });

    this.logger?.debug({ fileId }, 'Generated download URL');
    return url;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.ensureBucketExists();
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: fileId,
    });

    try {
      await this.client.send(command);
      this.logger?.info({ fileId }, 'File deleted from storage');
    } catch (error) {
      this.logger?.error({ error, fileId }, 'Failed to delete file from storage');
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Verify if file exists in storage
   */
  async verifyFileExists(fileId: string): Promise<boolean> {
    await this.ensureBucketExists();
    const command = new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: fileId,
    });

    try {
      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger?.error({ error, fileId }, 'Error checking file existence');
      throw new Error(`Failed to verify file existence: ${error}`);
    }
  }

  /**
   * Initialize bucket (create if doesn't exist)
   * Useful for MinIO development environments
   */
  async initializeBucket(): Promise<void> {
    try {
      // Check if bucket exists
      const headCommand = new HeadBucketCommand({
        Bucket: this.config.bucket,
      });
      
      await this.client.send(headCommand);
      this.logger?.debug({ bucket: this.config.bucket }, 'Bucket already exists');
    } catch (error: any) {
      // MinIO returns 400 for non-existent buckets in some cases, treat it as NotFound
      const isNotFound = error.name === 'NotFound' || 
                        error.$metadata?.httpStatusCode === 404 ||
                        (error.$metadata?.httpStatusCode === 400 && this.config.provider === 'minio');
      
      if (isNotFound) {
        // Create bucket if it doesn't exist
        try {
          const createCommand = new CreateBucketCommand({
            Bucket: this.config.bucket,
          });
          
          await this.client.send(createCommand);
          this.logger?.info({ bucket: this.config.bucket }, 'Bucket created successfully');
        } catch (createError: any) {
          // Ignore error if bucket already exists (race condition)
          if (createError.name === 'BucketAlreadyOwnedByYou' || createError.name === 'BucketAlreadyExists') {
            this.logger?.debug({ bucket: this.config.bucket }, 'Bucket already exists (race condition)');
          } else {
            this.logger?.error({ error: createError, bucket: this.config.bucket }, 'Failed to create bucket');
            throw new Error(`Failed to create bucket: ${createError}`);
          }
        }
      } else {
        this.logger?.error({ error, bucket: this.config.bucket }, 'Error checking bucket existence');
        throw new Error(`Failed to check bucket existence: ${error}`);
      }
    }
  }

  /**
   * Health check for storage connectivity
   * Ensures bucket exists and is accessible (self-healing for development)
   * Note: Creates bucket if it doesn't exist - essential for dev environments
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Ensure bucket exists (creates if needed)
      await this.ensureBucketExists();

      const headCommand = new HeadBucketCommand({
        Bucket: this.config.bucket,
      });

      await this.client.send(headCommand);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initiate a multipart upload — returns the S3 UploadId
   */
  async initiateMultipartUpload(fileId: string, filename: string, mimeType: string): Promise<string> {
    await this.ensureBucketExists();
    const command = new CreateMultipartUploadCommand({
      Bucket: this.config.bucket,
      Key: fileId,
      ContentType: mimeType,
      ContentDisposition: `attachment; filename="${filename}"`,
      ...this.sseParams,
    });
    const result = await this.client.send(command);
    if (!result.UploadId) {
      throw new Error('S3 did not return an UploadId for multipart upload');
    }
    this.logger?.info({ fileId, filename, mimeType }, 'Multipart upload initiated');
    return result.UploadId;
  }

  /**
   * Generate presigned URL for uploading a single part
   */
  async generatePartUploadUrl(fileId: string, uploadId: string, partNumber: number): Promise<string> {
    await this.ensureBucketExists();
    const command = new UploadPartCommand({
      Bucket: this.config.bucket,
      Key: fileId,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: this.config.uploadUrlExpiry,
    });
    this.logger?.debug({ fileId, partNumber }, 'Generated multipart part URL');
    return url;
  }

  /**
   * Complete a multipart upload by submitting part ETags
   */
  async completeMultipartUpload(
    fileId: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void> {
    await this.ensureBucketExists();
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.config.bucket,
      Key: fileId,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    });
    await this.client.send(command);
    this.logger?.info({ fileId, partCount: parts.length }, 'Multipart upload completed');
  }

  /**
   * Abort a multipart upload — cleans up all uploaded parts from S3
   */
  async abortMultipartUpload(fileId: string, uploadId: string): Promise<void> {
    await this.ensureBucketExists();
    const command = new AbortMultipartUploadCommand({
      Bucket: this.config.bucket,
      Key: fileId,
      UploadId: uploadId,
    });
    await this.client.send(command);
    this.logger?.info({ fileId, uploadId }, 'Multipart upload aborted');
  }
}

/**
 * Create storage provider instance based on configuration
 */
export function createStorageProvider(config: StorageConfig, logger?: Logger): StorageProvider {
  return new S3StorageProvider(config, logger);
}