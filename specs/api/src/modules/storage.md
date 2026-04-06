# Storage Module Documentation

## Overview

The Storage Module provides secure file upload, download, and management functionality for the Monobase service platform. It supports multiple storage backends (AWS S3, MinIO) through a unified API interface, with a maximum file size limit of 50MB for MVP.

## Table of Contents

- [Architecture](#architecture)
- [File Upload Process](#file-upload-process)
- [File Download Process](#file-download-process)
- [File Management Operations](#file-management-operations)
- [Storage Provider Abstraction](#storage-provider-abstraction)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)
- [Implementation Examples](#implementation-examples)

## Architecture

The storage module uses presigned URLs to offload file transfers directly to the storage backend (S3/MinIO), reducing server load and improving scalability. The API server only handles metadata and generates secure, time-limited URLs for upload/download operations.

### Key Design Decisions

- **Presigned URLs**: Direct client-to-storage transfers bypass the API server
- **50MB File Limit**: Simplified single-upload strategy (no multipart needed)
- **Hard Delete**: No soft delete - files are permanently removed
- **Explicit Parameters**: No generic filters - all query parameters are explicitly defined

## File Upload Process

The upload process consists of three steps: request permission, upload to storage, and confirm completion.

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client  │     │  API Server  │     │  S3/MinIO   │
└─────┬────┘     └──────┬───────┘     └──────┬──────┘
      │                  │                     │
      │ 1. POST /storage/files/upload          │
      │   {filename, size, mimeType}           │
      ├─────────────────►│                     │
      │                  │                     │
      │                  ├─ Validate metadata  │
      │                  ├─ Check size < 50MB  │
      │                  ├─ Create DB record   │
      │                  ├─ Generate presigned │
      │                  │  URL (5 min expiry) │
      │                  │                     │
      │ 2. Response with presigned URL         │
      │◄─────────────────┤                     │
      │   {file: id,     │                     │
      │    uploadUrl,    │                     │
      │    uploadMethod,  │                     │
      │    expiresAt}    │                     │
      │                  │                     │
      │ 3. PUT file to presigned URL           │
      ├────────────────────────────────────────►
      │                  │                     │
      │                  │    4. Upload success│
      │◄────────────────────────────────────────
      │                  │                     │
      │ 5. POST /storage/files/{id}/complete  │
      ├─────────────────►│                     │
      │                  │                     │
      │                  ├─ Verify file exists│
      │                  ├──────────────────► │
      │                  │◄───────────────────┤
      │                  ├─ Update status     │
      │                  ├─ Trigger processing│
      │                  │                     │
      │ 6. Return complete file metadata      │
      │◄─────────────────┤                     │
      │                  │                     │
```

### Upload Steps Explained

1. **Request Upload Permission**
   - Client sends file metadata (name, size, MIME type)
   - Server validates request (size < 50MB)
   - Creates database record with status "uploading"
   - Generates presigned URL with 5-minute expiry

2. **Direct Upload to Storage**
   - Client PUTs file directly to presigned URL
   - Bypasses API server completely
   - Storage provider handles the upload

3. **Confirm Upload Completion**
   - Client notifies server of successful upload
   - Server verifies file exists in storage
   - Updates status to "processing" then "available"
   - Returns complete file metadata

### Upload Error Scenarios

| Error | When | Response | Recovery |
|-------|------|----------|----------|
| File too large | Size > 50MB | 413 Payload Too Large | Reduce file size |
| Upload expired | After 5 minutes | URL expired | Restart from step 1 |
| Upload failed | Network/storage error | Storage error | Retry step 3 with same URL |
| Complete failed | Verification failed | 400 Bad Request | File remains "uploading" |

## File Download Process

The download process provides secure, time-limited access to files through presigned URLs.

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client  │     │  API Server  │     │  S3/MinIO   │
└─────┬────┘     └──────┬───────┘     └──────┬──────┘
      │                  │                     │
      │ 1. GET /storage/files/{id}/download    │
      ├─────────────────►│                     │
      │                  │                     │
      │                  ├─ Check permissions  │
      │                  ├─ Verify file exists │
      │                  ├─ Log audit trail    │
      │                  ├─ Generate presigned │
      │                  │  URL (15 min expiry)│
      │                  │                     │
      │ 2. Response with download URL          │
      │◄─────────────────┤                     │
      │   {downloadUrl,  │                     │
      │    expiresAt,    │                     │
      │    file: {...}}  │                     │
      │                  │                     │
      │ 3. GET file from presigned URL        │
      ├────────────────────────────────────────►
      │                  │                     │
      │                  │    4. Stream file   │
      │◄────────────────────────────────────────
      │                  │                     │
```

### Download Security Features

- **Time-limited URLs**: Expire after 15 minutes
- **Permission checks**: Every request validates user access
- **Audit logging**: All download requests are logged
- **No direct access**: Files only accessible through API-generated URLs

## File Management Operations

### Get File Metadata

Retrieve file information without download capability.

```
┌──────────┐     ┌──────────────┐
│  Client  │     │  API Server  │
└─────┬────┘     └──────┬───────┘
      │                  │
      │ GET /storage/files/{id}
      ├─────────────────►│
      │                  │
      │                  ├─ Check permissions
      │                  ├─ Query database
      │                  ├─ Format response
      │                  │
      │ Return metadata  │
      │◄─────────────────┤
      │                  │
```

**Returns**: filename, size, mimeType, status, createdAt, updatedAt, owner  
**Does NOT return**: file content or download URL

### List Files

Retrieve paginated list of files with filtering.

```
┌──────────┐     ┌──────────────┐
│  Client  │     │  API Server  │
└─────┬────┘     └──────┬───────┘
      │                  │
      │ GET /storage/files?status=available&limit=20
      ├─────────────────►│
      │                  │
      │                  ├─ Apply filters
      │                  ├─ Check ownership
      │                  ├─ Paginate results
      │                  │
      │ Return paginated │
      │◄─────────────────┤
      │                  │
```

**Query Parameters**:
- `status`: Filter by file status (uploading, processing, available, failed)
- `owner`: Filter by owner UUID
- `offset`: Pagination offset
- `limit`: Items per page (max 100)

### Delete File

Permanently remove file from storage and database.

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client  │     │  API Server  │     │  S3/MinIO   │
└─────┬────┘     └──────┬───────┘     └──────┬──────┘
      │                  │                     │
      │ DELETE /storage/files/{id}             │
      ├─────────────────►│                     │
      │                  │                     │
      │                  ├─ Check permissions  │
      │                  ├─ Delete from storage│
      │                  ├──────────────────► │
      │                  │◄───────────────────┤
      │                  ├─ Delete from DB     │
      │                  │                     │
      │ 204 No Content  │                     │
      │◄─────────────────┤                     │
      │                  │                     │
```

**Important**: This is a hard delete - the file and all metadata are permanently removed.

## Storage Provider Abstraction

The API remains consistent regardless of the storage backend. Provider selection is handled through configuration.

### Supported Providers

| Provider | Use Case | Configuration |
|----------|----------|---------------|
| AWS S3 | Production, global CDN | Region, bucket, credentials |
| MinIO | Self-hosted, on-premise | Endpoint, port, bucket, credentials |
| Local | Development only | Directory path |

### Configuration Example

```json
{
  "storage": {
    "provider": "minio",
    "endpoint": "http://localhost:9000",
    "bucket": "monobase-files",
    "credentials": {
      "accessKeyId": "minioadmin",
      "secretAccessKey": "minioadmin"
    }
  }
}
```

### Provider Features Comparison

| Feature | AWS S3 | MinIO | Local |
|---------|--------|-------|-------|
| Presigned URLs | ✅ | ✅ | ❌ |
| Scalability | Unlimited | Limited by hardware | Limited |
| CDN Integration | ✅ Built-in | ❌ Manual setup | ❌ |
| Cost | Pay-per-use | Infrastructure only | Free |
| Data Location | AWS regions | On-premise | Local disk |

## API Endpoints

### Upload File
`POST /storage/files/upload`

**Request Body:**
```json
{
  "filename": "document.pdf",
  "size": 1048576,
  "mimeType": "application/pdf"
}
```

**Response:** `201 Created` (ApiCreatedResponse<FileUploadResponse>)
```json
{
  "file": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "https://storage.example.com/...",
  "uploadMethod": "PUT",
  "expiresAt": "2025-01-01T12:30:00Z"
}
```

### Complete Upload
`POST /storage/files/{file}/complete`

**Response:** `200 OK` (ApiOkResponse<StoredFile>)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "status": "available",
  "owner": "user-uuid",
  "uploadedAt": "2025-01-01T12:00:00Z",
  "createdAt": "2025-01-01T12:00:00Z",
  "updatedAt": "2025-01-01T12:00:00Z",
  "version": 1,
  "createdBy": "user-uuid",
  "updatedBy": "user-uuid"
}
```

### Get Download URL
`GET /storage/files/{file}/download`

**Response:** `200 OK` (ApiOkResponse<FileDownloadResponse>)
```json
{
  "downloadUrl": "https://storage.example.com/...",
  "expiresAt": "2025-01-01T12:45:00Z",
  "file": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "document.pdf",
    "size": 1048576,
    "mimeType": "application/pdf",
    "status": "available",
    "owner": "user-uuid",
    "uploadedAt": "2025-01-01T12:00:00Z",
    "createdAt": "2025-01-01T12:00:00Z",
    "updatedAt": "2025-01-01T12:00:00Z",
    "version": 1,
    "createdBy": "user-uuid",
    "updatedBy": "user-uuid"
  }
}
```

### Get File Metadata
`GET /storage/files/{file}`

**Response:** `200 OK` (ApiOkResponse<StoredFile>)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "status": "available",
  "owner": "user-uuid",
  "uploadedAt": "2025-01-01T12:00:00Z",
  "createdAt": "2025-01-01T12:00:00Z",
  "updatedAt": "2025-01-01T12:00:00Z",
  "version": 1,
  "createdBy": "user-uuid",
  "updatedBy": "user-uuid"
}
```

### List Files
`GET /storage/files?status=available&owner=user-uuid&offset=0&limit=20`

**Response:** `200 OK` (ApiOkResponse<PaginatedResponse<StoredFile>>)
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "document.pdf",
      "size": 1048576,
      "mimeType": "application/pdf",
      "status": "available",
      "owner": "user-uuid",
      "uploadedAt": "2025-01-01T12:00:00Z",
      "createdAt": "2025-01-01T12:00:00Z",
      "updatedAt": "2025-01-01T12:00:00Z",
      "version": 1,
      "createdBy": "user-uuid",
      "updatedBy": "user-uuid"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "count": 1,
    "totalCount": 1,
    "totalPages": 1,
    "currentPage": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Delete File
`DELETE /storage/files/{file}`

**Response:** `204 No Content` (ApiNoContentResponse)

## Data Models

### FileStatus Enum
```typescript
enum FileStatus {
  uploading = "uploading",   // File is being uploaded
  processing = "processing", // Upload completed, processing
  available = "available",   // File is ready for use
  failed = "failed"         // Upload or processing failed
}
```

### StoredFile Model
```typescript
interface StoredFile {
  id: string;              // UUID
  filename: string;        // Original filename
  mimeType: string;        // MIME type
  size: number;           // Size in bytes
  status: FileStatus;     // Current status
  owner: string;          // Owner UUID
  uploadedAt: Date;       // Upload timestamp
  createdAt: Date;        // Creation timestamp
  updatedAt: Date;        // Last update timestamp
}
```

### FileMetadata Model
```typescript
interface FileMetadata {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
  owner: FileOwner;
}
```

### FileOwner Model
```typescript
interface FileOwner {
  id: string;
  type: "patient" | "provider" | "admin" | "system";
  name: string;
}
```

## Error Handling

### Common Error Responses

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid request data |
| 401 | AuthenticationError | Missing or invalid authentication |
| 403 | AuthorizationError | Insufficient permissions |
| 404 | NotFoundError | File not found |
| 413 | PayloadTooLarge | File exceeds 50MB limit |
| 500 | InternalServerError | Server error |

### Error Response Format
```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds maximum limit of 50MB",
    "details": {
      "maxSize": 52428800,
      "providedSize": 104857600
    }
  }
}
```

## Security Considerations

### Authentication & Authorization
- All endpoints require authentication via Authorization header
- File access is restricted to owner and authorized users
- Delete operations restricted to file owner only
- Admin users can read/download but not delete user files

### Data Protection
- Files are encrypted at rest in storage
- TLS 1.3 for all data in transit
- Presigned URLs expire after specified time
- No permanent public URLs

### Audit Trail
- All file operations are logged
- Audit logs include: user, action, timestamp, IP address
- Logs are immutable and retained per compliance requirements

### Data Security Compliance
- Sensitive files are tagged and encrypted
- Access logs maintained for all files
- Automatic purging of expired files per retention policy

## Implementation Examples

### JavaScript/TypeScript Upload Example

```typescript
// Step 1: Request upload permission
const uploadRequest = await fetch('/storage/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filename: 'medical-record.pdf',
    size: file.size,
    mimeType: file.type
  })
});

const { file: fileId, uploadUrl, expiresAt } = await uploadRequest.json();

// Step 2: Upload file to presigned URL
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
});

if (!uploadResponse.ok) {
  throw new Error('Upload failed');
}

// Step 3: Confirm upload completion
const completeResponse = await fetch(`/storage/files/${fileId}/complete`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const fileMetadata = await completeResponse.json();
console.log('File uploaded successfully:', fileMetadata);
```

### Download Example

```typescript
// Get download URL
const downloadResponse = await fetch(`/storage/files/${fileId}/download`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { downloadUrl } = await downloadResponse.json();

// Download file
const fileResponse = await fetch(downloadUrl);
const blob = await fileResponse.blob();

// Create download link
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'medical-record.pdf';
a.click();
window.URL.revokeObjectURL(url);
```

### Error Handling Example

```typescript
async function uploadFileWithRetry(file: File, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Request upload
      const { uploadUrl, fileId } = await requestUpload(file);
      
      // Upload with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      // Complete upload
      return await completeUpload(fileId);
      
    } catch (error) {
      lastError = error;
      
      if (error.name === 'AbortError') {
        console.log(`Upload timeout on attempt ${attempt}`);
      } else if (error.status === 413) {
        throw new Error('File too large');
      } else if (attempt < maxRetries) {
        console.log(`Retry attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError;
}
```

## Best Practices

### Client Implementation
1. **Validate file size** before requesting upload
2. **Show upload progress** using XMLHttpRequest or fetch with progress events
3. **Implement retry logic** for network failures
4. **Handle expiry** by requesting new URLs when needed
5. **Clean up** failed uploads by calling delete endpoint

### Server Implementation
1. **Use background jobs** for file processing after upload
2. **Implement virus scanning** before marking files as available
3. **Set up lifecycle policies** in storage for automatic cleanup
4. **Monitor storage usage** and implement quotas
5. **Use CDN** for frequently accessed files

### Performance Optimization
1. **Cache presigned URLs** for download (but respect expiry)
2. **Use multipart uploads** for files > 100MB (future enhancement)
3. **Compress files** before upload when appropriate
4. **Implement thumbnail generation** for images
5. **Use HTTP/2** for parallel file operations

## Monitoring & Metrics

### Key Metrics to Track
- Upload success rate
- Average upload time by file size
- Storage usage by user/organization
- Failed upload reasons
- Presigned URL generation time
- Most accessed files

### Alerts to Configure
- Upload failure rate > 5%
- Storage usage > 80% of quota
- Presigned URL generation latency > 1s
- File processing queue depth > 100
- Virus/malware detection

## Future Enhancements

### Planned Features
1. **Multipart upload** for files > 100MB
2. **File versioning** with history tracking
3. **Shared folders** and team collaboration
4. **File preview** generation (thumbnails, PDF preview)
5. **Bulk operations** (download multiple, bulk delete)
6. **Public sharing** with expiring links
7. **Client-side encryption** for sensitive files
8. **Resumable uploads** for unreliable connections
9. **File tagging** and advanced search
10. **Storage analytics** dashboard

### API Version 2.0 Considerations
- GraphQL support for flexible queries
- WebSocket notifications for upload progress
- Batch upload API for multiple files
- Direct integration with EMR module
- Automated DICOM image handling