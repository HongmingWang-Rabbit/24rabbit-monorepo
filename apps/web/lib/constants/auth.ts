// Session configuration constants
export const SESSION_DURATION_DAYS = 7;
export const SESSION_UPDATE_HOURS = 24;

// Computed values in seconds
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * SESSION_DURATION_DAYS;
export const SESSION_UPDATE_AGE = 60 * 60 * SESSION_UPDATE_HOURS;

// Password requirements
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Environment helpers
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Parse trusted origins from environment variable
 * Format: comma-separated URLs
 * Falls back to localhost origins in development
 */
export function getTrustedOrigins(): string[] {
  const envOrigins = process.env.TRUSTED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim());
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (IS_PRODUCTION) {
    return [baseUrl];
  }

  // Development: include common localhost ports
  return [baseUrl, 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'];
}
