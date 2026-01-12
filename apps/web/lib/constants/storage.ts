// Storage configuration constants - safe for client and server

export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  allowedDocumentTypes: ['text/plain', 'application/pdf', 'text/markdown'],
} as const;

export const ALLOWED_MIME_TYPES: readonly string[] = [
  ...UPLOAD_CONFIG.allowedImageTypes,
  ...UPLOAD_CONFIG.allowedVideoTypes,
  ...UPLOAD_CONFIG.allowedDocumentTypes,
];

export type AllowedMimeType =
  | (typeof UPLOAD_CONFIG.allowedImageTypes)[number]
  | (typeof UPLOAD_CONFIG.allowedVideoTypes)[number]
  | (typeof UPLOAD_CONFIG.allowedDocumentTypes)[number];
