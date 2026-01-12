import { Facebook, Twitter, Linkedin, Instagram, Youtube, type LucideIcon } from 'lucide-react';
import type { SocialPlatform } from '@24rabbit/shared';

/**
 * UI-specific platform configuration.
 * Display names should come from i18n (platforms.facebook, etc.)
 * This maps to SocialPlatform from @24rabbit/shared
 */
export const PLATFORM_UI_CONFIG: Record<
  SocialPlatform,
  {
    icon: LucideIcon;
    color: string;
    bgColor: string;
  }
> = {
  FACEBOOK: {
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600',
  },
  TWITTER: {
    icon: Twitter,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500',
  },
  LINKEDIN: {
    icon: Linkedin,
    color: 'text-blue-700',
    bgColor: 'bg-blue-700',
  },
  INSTAGRAM: {
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-600',
  },
  YOUTUBE: {
    icon: Youtube,
    color: 'text-red-600',
    bgColor: 'bg-red-600',
  },
  REDDIT: {
    icon: Facebook, // TODO: Add Reddit icon when available
    color: 'text-orange-600',
    bgColor: 'bg-orange-600',
  },
  TIKTOK: {
    icon: Youtube, // TODO: Add TikTok icon when available
    color: 'text-black dark:text-white',
    bgColor: 'bg-black',
  },
};

/** Platforms currently available for connection */
export const AVAILABLE_PLATFORMS: SocialPlatform[] = ['FACEBOOK', 'TWITTER', 'LINKEDIN'];

/** Platforms coming soon */
export const COMING_SOON_PLATFORMS: SocialPlatform[] = ['INSTAGRAM', 'YOUTUBE', 'REDDIT', 'TIKTOK'];

/**
 * Get i18n key for platform name
 * Usage: t(`platforms.${getPlatformI18nKey('FACEBOOK')}`) -> "Facebook"
 */
export function getPlatformI18nKey(platform: SocialPlatform): string {
  return platform.toLowerCase();
}
