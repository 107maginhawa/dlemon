# Storage edge cases: 50MB cap, missing-file 404 on download, can't
# download a file still in `uploading` status, non-owner can't fetch
# someone else's file, special chars in filename are preserved.

POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "storage-edge-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Storage Edge"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Storage",
  "lastName": "Edge",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. Files larger than 50MB are rejected at presign time (52428801 bytes
# is just over the 50 MiB cap).
POST {{api}}/storage/files/upload
Content-Type: application/json
{
  "filename": "too-big.bin",
  "size": 52428801,
  "mimeType": "application/octet-stream"
}
HTTP 400


# 2. Non-existent file id 404 on download.
GET {{api}}/storage/files/00000000-0000-4000-8000-000000000000/download
HTTP 404


# 3. Non-existent file id 404 on get.
GET {{api}}/storage/files/00000000-0000-4000-8000-000000000000
HTTP 404


# 4. Pre-complete file cannot be downloaded.
POST {{api}}/storage/files/upload
Content-Type: application/json
{
  "filename": "pending.txt",
  "size": 11,
  "mimeType": "text/plain"
}
HTTP 201
[Captures]
pending_file: jsonpath "$.file"


GET {{api}}/storage/files/{{pending_file}}/download
HTTP *
[Asserts]
status >= 400
status < 500


# 5. Filenames with special characters round-trip through metadata.
POST {{api}}/storage/files/upload
Content-Type: application/json
{
  "filename": "Anaïs's résumé (final v2).pdf",
  "size": 42,
  "mimeType": "application/pdf"
}
HTTP 201
[Captures]
special_file: jsonpath "$.file"


GET {{api}}/storage/files/{{special_file}}
HTTP 200
[Asserts]
jsonpath "$.filename" == "Anaïs's résumé (final v2).pdf"


# 6. Another user cannot read someone else's file metadata.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "storage-other-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Storage Other"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Storage",
  "lastName": "Other",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


GET {{api}}/storage/files/{{special_file}}
HTTP *
[Asserts]
status >= 401
status <= 404
