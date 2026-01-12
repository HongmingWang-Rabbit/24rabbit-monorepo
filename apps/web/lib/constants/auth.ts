// Session configuration constants
export const SESSION_DURATION_DAYS = 7;
export const SESSION_UPDATE_HOURS = 24;

// Computed values in seconds
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * SESSION_DURATION_DAYS;
export const SESSION_UPDATE_AGE = 60 * 60 * SESSION_UPDATE_HOURS;

// Password requirements
export const PASSWORD_MIN_LENGTH = 8;
