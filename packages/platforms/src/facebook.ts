import { retry } from '@24rabbit/shared';
import type {
  PlatformConnector,
  PublishParams,
  PublishResult,
  PostAnalytics,
  TokenRefreshResult,
} from './types';

const FACEBOOK_GRAPH_API = 'https://graph.facebook.com/v19.0';

export class FacebookConnector implements PlatformConnector {
  platform = 'FACEBOOK' as const;

  async publishPost(params: PublishParams): Promise<PublishResult> {
    const { content, mediaUrls, accessToken, pageId } = params;

    if (!pageId) {
      return { success: false, error: 'Page ID is required for Facebook posts' };
    }

    try {
      let postId: string;

      if (mediaUrls && mediaUrls.length > 0) {
        // Post with media
        const photoIds = await Promise.all(
          mediaUrls.map((url) => this.uploadPhoto(pageId, url, accessToken))
        );

        const response = await retry(() =>
          fetch(`${FACEBOOK_GRAPH_API}/${pageId}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content,
              attached_media: photoIds.map((id) => ({ media_fbid: id })),
              access_token: accessToken,
            }),
          })
        );

        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.error?.message || 'Failed to post' };
        }
        postId = data.id;
      } else {
        // Text-only post
        const response = await retry(() =>
          fetch(`${FACEBOOK_GRAPH_API}/${pageId}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content,
              access_token: accessToken,
            }),
          })
        );

        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.error?.message || 'Failed to post' };
        }
        postId = data.id;
      }

      return {
        success: true,
        platformPostId: postId,
        publishedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async uploadPhoto(
    pageId: string,
    photoUrl: string,
    accessToken: string
  ): Promise<string> {
    const response = await fetch(`${FACEBOOK_GRAPH_API}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: photoUrl,
        published: false,
        access_token: accessToken,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload photo');
    }
    return data.id;
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    // Note: This requires an access token with appropriate permissions
    // Implementation would need to be expanded for production use

    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    const response = await fetch(
      `${FACEBOOK_GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: process.env.FACEBOOK_CLIENT_ID || '',
          client_secret: process.env.FACEBOOK_CLIENT_SECRET || '',
          fb_exchange_token: refreshToken,
        })
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to refresh token');
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }
}

export const createFacebookConnector = () => new FacebookConnector();
