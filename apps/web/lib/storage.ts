import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MaterialType } from '@24rabbit/database';
import { UPLOAD_CONFIG } from './constants/storage';

// Re-export for convenience
export { UPLOAD_CONFIG, ALLOWED_MIME_TYPES } from './constants/storage';

// Presigned URL expiry time in seconds
const PRESIGNED_URL_EXPIRES_IN = 3600; // 1 hour

// Storage configuration from environment
function getStorageConfig() {
  return {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME || '24rabbit',
    endpoint: process.env.R2_ENDPOINT || 'http://localhost:9000',
    publicUrl: process.env.R2_PUBLIC_URL || 'http://localhost:9000/24rabbit',
  };
}

// Lazily initialized S3 client singleton
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const config = getStorageConfig();

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error(
      'Storage credentials not configured. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables.'
    );
  }

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // Required for MinIO
  });

  return s3ClientInstance;
}

export type PresignedUploadResult = {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
};

/**
 * Sanitize filename to prevent path traversal and other security issues
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Allow only safe characters
    .replace(/\.{2,}/g, '.') // Collapse consecutive dots (prevents ../)
    .replace(/^[._-]+/, '') // Remove leading dots, underscores, dashes
    .slice(0, 255); // Limit length
}

/**
 * Generate a presigned URL for uploading a file directly to S3/MinIO
 */
export async function getPresignedUploadUrl(
  organizationId: string,
  filename: string,
  contentType: string,
  expiresIn = PRESIGNED_URL_EXPIRES_IN
): Promise<PresignedUploadResult> {
  const s3Client = getS3Client();
  const config = getStorageConfig();

  const timestamp = Date.now();
  const sanitizedFilename = sanitizeFilename(filename);
  const fileKey = `materials/${organizationId}/${timestamp}-${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const publicUrl = `${config.publicUrl}/${fileKey}`;

  return {
    uploadUrl,
    fileKey,
    publicUrl,
  };
}

/**
 * Delete a file from S3/MinIO
 */
export async function deleteFile(fileKey: string): Promise<void> {
  const s3Client = getS3Client();
  const config = getStorageConfig();

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: fileKey,
  });

  await s3Client.send(command);
}

/**
 * Get the public URL for a file
 */
export function getPublicUrl(fileKey: string): string {
  const config = getStorageConfig();
  return `${config.publicUrl}/${fileKey}`;
}

/**
 * Determine material type from MIME type
 */
export function getMaterialTypeFromMime(mimeType: string): MaterialType {
  if (
    UPLOAD_CONFIG.allowedImageTypes.includes(
      mimeType as (typeof UPLOAD_CONFIG.allowedImageTypes)[number]
    )
  ) {
    return 'IMAGE';
  }
  if (
    UPLOAD_CONFIG.allowedVideoTypes.includes(
      mimeType as (typeof UPLOAD_CONFIG.allowedVideoTypes)[number]
    )
  ) {
    return 'VIDEO';
  }
  if (
    UPLOAD_CONFIG.allowedDocumentTypes.includes(
      mimeType as (typeof UPLOAD_CONFIG.allowedDocumentTypes)[number]
    )
  ) {
    return 'TEXT';
  }
  return 'FILE';
}
