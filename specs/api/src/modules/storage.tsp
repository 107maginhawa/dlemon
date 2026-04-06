import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * File reference that can be either a stored file or external URL
 */
@doc("File reference supporting both stored files and external URLs")
model MaybeStoredFile {
  @doc("Reference to stored file ID")
  file?: UUID;

  @doc("Direct URL to file")
  @format("uri")
  url: string;
}

/**
 * File reference for updates (with nullable fields)
 */
@doc("File reference for updates - can be null to clear")
model MaybeStoredFileUpdate {
  @doc("Reference to stored file ID - can be null to clear")
  file?: UUID | null;

  @doc("Direct URL to file")
  @format("uri")
  url?: string;
}


/**
 * Storage Management Module - MVP
 * 
 * Provides basic file upload, download, and management functionality.
 * Focuses on core storage operations with simple access control.
 */

/**
 * Stored file model - simplified for MVP
 */
@doc("Basic file storage model")
model StoredFile extends BaseEntity {
  @doc("Original filename")
  @maxLength(255)
  filename: string;

  @doc("MIME type")
  @maxLength(100)  
  mimeType: string;

  @doc("File size in bytes")
  @minValue(0)
  size: int64;

  @doc("File status")
  status: FileStatus;

  @doc("File owner user ID")
  owner: UUID;

  @doc("Upload timestamp")
  uploadedAt: utcDateTime;
}


/**
 * File status enumeration - simplified for MVP
 */
@doc("Basic file processing status")
enum FileStatus {
  @doc("File is being uploaded")
  uploading: "uploading",
  
  @doc("File upload completed, processing")
  processing: "processing",
  
  @doc("File is available")
  available: "available",
  
  @doc("File upload failed")
  failed: "failed",
}


/**
 * File upload request model - simplified for MVP
 */
@doc("Basic file upload request")
model FileUploadRequest {
  @doc("Original filename")
  @maxLength(255)
  filename: string;

  @doc("File size in bytes")
  @minValue(1)
  size: int64;

  @doc("MIME type")
  @maxLength(100)
  mimeType: string;
}

/**
 * File upload response model - simplified for MVP
 */
@doc("Basic file upload response with presigned URL")
model FileUploadResponse {
  @doc("Generated file identifier")
  file: UUID;

  @doc("Upload URL (presigned)")
  uploadUrl: Url;

  @doc("Upload method - always PUT for simplicity")
  uploadMethod: "PUT";

  @doc("Upload expiration time")
  expiresAt: utcDateTime;
}

/**
 * File download response - simplified for MVP
 */
@doc("Basic file download response")
model FileDownloadResponse {
  @doc("Secure download URL")
  downloadUrl: Url;

  @doc("Download URL expiration time")
  expiresAt: utcDateTime;

  @doc("File information")
  file: StoredFile;
}



/**
 * Storage management endpoints - MVP operations only
 */
namespace StorageModule {
  interface StorageManagement {
    @doc("Upload a file - Step 1 of upload process. Returns presigned URL for direct upload to storage backend (S3/MinIO). Max file size: 50MB.")
    @operationId("uploadFile")
    @post
    @route("/storage/files/upload")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    uploadFile(
      @body request: FileUploadRequest
    ): ApiCreatedResponse<FileUploadResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @doc("Complete file upload - Step 2 of upload process. Confirms upload completion, validates file in storage, and triggers post-processing.")
    @operationId("completeFileUpload")
    @post
    @route("/storage/files/{file}/complete")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:owner"])
    completeFileUpload(
      @path file: UUID
    ): ApiOkResponse<StoredFile>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @doc("Get file download URL. Returns a time-limited presigned URL for secure file download. URL expires after 15 minutes.")
    @operationId("getFileDownload")
    @get
    @route("/storage/files/{file}/download")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "user:owner"])
    getFileDownload(
      @path file: UUID
    ): ApiOkResponse<FileDownloadResponse>
      | ApiNotFoundResponse
      | ApiForbiddenResponse
      | ApiUnauthorizedResponse;

    @doc("Get file metadata. Returns file information without download URL. Use /download endpoint to get actual file content.")
    @operationId("getFile")
    @get
    @route("/storage/files/{file}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "user:owner"])
    getFile(
      @path file: UUID
    ): ApiOkResponse<StoredFile>
      | ApiNotFoundResponse
      | ApiForbiddenResponse
      | ApiUnauthorizedResponse;

    @doc("List files with basic filtering. Requires authentication. Returns paginated list of files accessible to the user. Supports filtering by status and owner.")
    @operationId("listFiles")
    @get
    @route("/storage/files")
    @useAuth(bearerAuth)
    listFiles(
      @doc("Filter by file status (uploading, processing, available, failed)")
      @query status?: FileStatus,
      @doc("Filter by file owner UUID")
      @query owner?: UUID,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<StoredFile>>
      | ApiUnauthorizedResponse;

    @doc("Delete file. Permanently deletes file from database and storage. This action cannot be undone.")
    @operationId("deleteFile")
    @delete
    @route("/storage/files/{file}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:owner"])
    deleteFile(
      @path file: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse
      | ApiUnauthorizedResponse;
  }
}
