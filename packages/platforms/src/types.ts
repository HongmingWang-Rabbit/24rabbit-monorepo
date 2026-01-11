import type { SocialPlatform } from '@24rabbit/shared';

// Platform Connector Interface
export interface PlatformConnector {
  platform: SocialPlatform;
  publishPost(params: PublishParams): Promise<PublishResult>;
  getPostAnalytics(postId: string): Promise<PostAnalytics>;
  refreshToken(refreshToken: string): Promise<TokenRefreshResult>;
}

export interface PublishParams {
  content: string;
  mediaUrls?: string[];
  accessToken: string;
  pageId?: string; // For platforms that require page selection
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  publishedAt?: Date;
}

export interface PostAnalytics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks?: number;
  reach?: number;
  engagement?: number;
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}
