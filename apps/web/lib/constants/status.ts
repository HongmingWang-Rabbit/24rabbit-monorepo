import { Check, Circle, Link2, type LucideIcon } from 'lucide-react';

/**
 * UI-specific material status for display purposes.
 * These are workflow states in the UI, distinct from MaterialStatus in @24rabbit/shared
 * which tracks usage (UNUSED, USED_ONCE, USED_MULTIPLE).
 */
export const UI_MATERIAL_STATUS = {
  uploaded: {
    key: 'uploaded',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  processing: {
    key: 'processing',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  analyzed: {
    key: 'analyzed',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  ready: {
    key: 'ready',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  used: {
    key: 'used',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  archived: {
    key: 'archived',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  failed: {
    key: 'failed',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
} as const;

export type UIMaterialStatus = keyof typeof UI_MATERIAL_STATUS;

export const TOKEN_STATUS = {
  valid: {
    key: 'valid',
    color: 'text-green-600',
  },
  expiring: {
    key: 'expiring',
    color: 'text-yellow-600',
  },
  expired: {
    key: 'expired',
    color: 'text-red-600',
  },
} as const;

export type TokenStatus = keyof typeof TOKEN_STATUS;

export const ACTIVITY_TYPES: Record<
  string,
  {
    icon: LucideIcon;
    color: string;
  }
> = {
  published: {
    icon: Check,
    color: 'text-green-600',
  },
  analyzed: {
    icon: Check,
    color: 'text-green-600',
  },
  pending: {
    icon: Circle,
    color: 'text-yellow-600',
  },
  connected: {
    icon: Link2,
    color: 'text-green-600',
  },
} as const;

export type ActivityType = keyof typeof ACTIVITY_TYPES;
