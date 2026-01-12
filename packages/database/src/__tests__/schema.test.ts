import { describe, it, expect } from 'vitest';
import {
  memberRole,
  subscriptionTier,
  socialPlatform,
  contentAngle,
  materialStatus,
} from '../schema/enums';

describe('Database Enums', () => {
  it('should have correct member roles', () => {
    expect(memberRole.enumValues).toEqual(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
  });

  it('should have correct subscription tiers', () => {
    expect(subscriptionTier.enumValues).toEqual([
      'FREE',
      'STARTER',
      'GROWTH',
      'BUSINESS',
      'ENTERPRISE',
    ]);
  });

  it('should have correct social platforms', () => {
    expect(socialPlatform.enumValues).toContain('TWITTER');
    expect(socialPlatform.enumValues).toContain('FACEBOOK');
    expect(socialPlatform.enumValues).toContain('LINKEDIN');
    expect(socialPlatform.enumValues).toContain('INSTAGRAM');
  });

  it('should have correct content angles', () => {
    expect(contentAngle.enumValues).toEqual([
      'PRODUCT_FOCUS',
      'USER_BENEFIT',
      'STORYTELLING',
      'EDUCATIONAL',
      'SOCIAL_PROOF',
      'PROMOTIONAL',
    ]);
  });

  it('should have correct material statuses', () => {
    expect(materialStatus.enumValues).toContain('UPLOADED');
    expect(materialStatus.enumValues).toContain('READY');
    expect(materialStatus.enumValues).toContain('USED');
  });
});
