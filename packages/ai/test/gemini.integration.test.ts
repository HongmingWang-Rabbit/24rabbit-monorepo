/**
 * Gemini Integration Tests
 *
 * These tests make REAL API calls to the Gemini API.
 * They require a valid GEMINI_API_KEY in your .env.local file.
 *
 * Run with: pnpm test packages/ai/test/gemini.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createGeminiAdapter } from '../src/gemini';
import type { AIAdapter, SocialPlatform } from '../src/types';

// Skip all tests if no real API key is available
const REAL_API_KEY = process.env.GEMINI_API_KEY;
const hasRealApiKey = REAL_API_KEY && REAL_API_KEY !== 'test-api-key';

describe.skipIf(!hasRealApiKey)('Gemini Integration Tests', () => {
  let adapter: AIAdapter;

  beforeAll(() => {
    adapter = createGeminiAdapter(REAL_API_KEY!);
  });

  describe('analyzeImage', () => {
    it('should analyze a real image from URL', async () => {
      // Using picsum.photos which doesn't rate limit
      const result = await adapter.analyzeImage('https://picsum.photos/id/1/400/300');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.description).toBeDefined();
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(10);
      expect(Array.isArray(result.objects)).toBe(true);
      expect(Array.isArray(result.colors)).toBe(true);
      expect(result.mood).toBeDefined();
      console.log('Image analysis result:', result);
    }, 30000);

    it('should analyze another image', async () => {
      const result = await adapter.analyzeImage('https://picsum.photos/id/26/400/300');

      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(10);
      expect(Array.isArray(result.suggestedHashtags)).toBe(true);
      console.log('Second image analysis result:', result);
    }, 30000);
  });

  describe('generateCopy', () => {
    it('should generate social media copy for Twitter', async () => {
      const result = await adapter.generateCopy({
        platform: 'TWITTER' as SocialPlatform,
        material: {
          summary:
            'New artisan coffee blend launching this week - single origin Ethiopian beans with notes of blueberry and dark chocolate',
          keyPoints: ['Single origin Ethiopian', 'Artisan roasted', 'Limited batch'],
          keywords: ['coffee', 'morning', 'energy', 'premium'],
        },
        maxLength: 280,
        includeHashtags: true,
        hashtagCount: 3,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(10);
      expect(Array.isArray(result.hashtags)).toBe(true);
      expect(result.estimatedEngagement).toBeDefined();
      console.log('Twitter copy:', result.content);
      console.log('Hashtags:', result.hashtags);
    }, 30000);

    it('should generate longer copy for LinkedIn', async () => {
      const result = await adapter.generateCopy({
        platform: 'LINKEDIN' as SocialPlatform,
        material: {
          summary:
            'Our startup just hit 1 million users - a major milestone achieved through team dedication and customer focus',
          keyPoints: [
            '1 million users milestone',
            'Team effort',
            'Customer-centric approach',
            '2 years of growth',
          ],
          keywords: ['growth', 'milestone', 'team', 'startup', 'success'],
        },
        brandVoice: 'Professional and inspiring',
        maxLength: 1500,
        includeHashtags: true,
        hashtagCount: 5,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(50);
      console.log('LinkedIn copy:', result.content);
    }, 30000);

    it('should generate copy for Instagram', async () => {
      const result = await adapter.generateCopy({
        platform: 'INSTAGRAM' as SocialPlatform,
        material: {
          summary: 'Weekend flash sale - 30% off all summer collection items',
          keyPoints: ['30% discount', 'Summer collection', 'Weekend only', 'Online and in-store'],
          keywords: ['sale', 'discount', 'shopping', 'summer', 'fashion'],
        },
        maxLength: 500,
        includeHashtags: true,
        hashtagCount: 10,
        emojiUsage: 'moderate',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(10);
      console.log('Instagram copy:', result.content);
    }, 30000);
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const embedding = await adapter.generateEmbedding('Hello world, this is a test message.');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // Gemini text-embedding-004 dimension
      expect(embedding.every((v) => typeof v === 'number')).toBe(true);
      console.log('Embedding dimension:', embedding.length);
      console.log('First 5 values:', embedding.slice(0, 5));
    }, 30000);

    it('should generate similar embeddings for similar texts', async () => {
      const embedding1 = await adapter.generateEmbedding('I love programming in TypeScript');
      const embedding2 = await adapter.generateEmbedding('TypeScript programming is my passion');
      const embedding3 = await adapter.generateEmbedding('I enjoy cooking Italian food');

      // Calculate cosine similarity
      const cosineSimilarity = (a: number[], b: number[]): number => {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      };

      const similarity12 = cosineSimilarity(embedding1, embedding2);
      const similarity13 = cosineSimilarity(embedding1, embedding3);

      console.log('Similarity between programming texts:', similarity12);
      console.log('Similarity between programming and cooking:', similarity13);

      // Similar texts should have higher similarity
      expect(similarity12).toBeGreaterThan(similarity13);
      expect(similarity12).toBeGreaterThan(0.7); // Should be quite similar
    }, 60000);
  });
});

// Info message when tests are skipped
describe('Gemini Integration Test Info', () => {
  it('should show API key status', () => {
    if (hasRealApiKey) {
      console.log('✓ Real GEMINI_API_KEY detected - integration tests will run');
    } else {
      console.log(
        '⚠ No real GEMINI_API_KEY detected - integration tests skipped. Set a valid key in .env.local to run them.'
      );
    }
    expect(true).toBe(true);
  });
});
