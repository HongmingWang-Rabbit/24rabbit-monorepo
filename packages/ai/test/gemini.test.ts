/**
 * GeminiAdapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiAdapter, createGeminiAdapter, createAIAdapter, GEMINI_MODELS } from '../src/gemini';
import { AIError, fetchImageAsBase64 } from '../src/utils';
import { EMBEDDING_DIMENSION } from '../src/types';

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return { getGenerativeModel: vi.fn() };
  }),
}));

// Mock fetchImageAsBase64
vi.mock('../src/utils', async () => {
  const actual = await vi.importActual('../src/utils');
  return {
    ...actual,
    fetchImageAsBase64: vi.fn(),
  };
});

describe('GeminiAdapter', () => {
  const mockGenerateContent = vi.fn();
  const mockEmbedContent = vi.fn();
  const mockGetGenerativeModel = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock model
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
      embedContent: mockEmbedContent,
    });

    // Get the mocked GoogleGenerativeAI
    const { GoogleGenerativeAI } = vi.mocked(await import('@google/generative-ai'));
    GoogleGenerativeAI.mockImplementation(function () {
      return { getGenerativeModel: mockGetGenerativeModel };
    });

    // Set env var for tests
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('constructor', () => {
    it('should create adapter with API key from options', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'custom-key' });

      expect(adapter).toBeInstanceOf(GeminiAdapter);
    });

    it('should create adapter with API key from env', async () => {
      const adapter = new GeminiAdapter();

      expect(adapter).toBeInstanceOf(GeminiAdapter);
    });

    it('should throw AIError if no API key provided', async () => {
      delete process.env.GEMINI_API_KEY;

      expect(() => new GeminiAdapter()).toThrow(AIError);
      expect(() => new GeminiAdapter()).toThrow('GEMINI_API_KEY is required');
    });

    it('should use default models', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      // Access private property for testing
      expect((adapter as unknown as { models: typeof GEMINI_MODELS }).models).toEqual({
        default: GEMINI_MODELS.default,
        video: GEMINI_MODELS.video,
        embedding: GEMINI_MODELS.embedding,
      });
    });

    it('should allow custom models', async () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test',
        models: {
          default: 'custom-model',
          video: 'custom-video-model',
          embedding: 'custom-embedding-model',
        },
      });

      expect((adapter as unknown as { models: { default: string } }).models.default).toBe(
        'custom-model'
      );
    });
  });

  describe('analyzeImage', () => {
    it('should analyze image and return result', async () => {
      const mockResult = {
        description: 'A test image',
        objects: ['test'],
        colors: ['blue'],
        mood: 'calm',
        suggestedHashtags: ['test'],
      };

      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResult) },
      });

      vi.mocked(fetchImageAsBase64).mockResolvedValue({
        data: 'base64data',
        mimeType: 'image/png',
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });
      const result = await adapter.analyzeImage('https://example.com/image.png');

      expect(result).toEqual(mockResult);
      expect(fetchImageAsBase64).toHaveBeenCalledWith('https://example.com/image.png');
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should throw on invalid URL', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(adapter.analyzeImage('')).rejects.toThrow(AIError);
      await expect(adapter.analyzeImage('')).rejects.toThrow('Invalid image URL');
    });

    it('should throw on malformed URL', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(adapter.analyzeImage('not-a-url')).rejects.toThrow(AIError);
      await expect(adapter.analyzeImage('not-a-url')).rejects.toThrow('Invalid image URL format');
    });
  });

  describe('analyzeVideo', () => {
    it('should analyze video and return result', async () => {
      const mockResult = {
        description: 'A test video',
        keyMoments: [{ timestamp: 0, description: 'start' }],
        transcript: 'Hello',
        suggestedHashtags: ['video'],
        bestThumbnailTimestamp: 5,
      };

      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResult) },
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });
      const result = await adapter.analyzeVideo('https://example.com/video.mp4');

      expect(result).toEqual(mockResult);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: GEMINI_MODELS.video });
    });

    it('should use custom mime type', async () => {
      const mockResult = {
        description: 'A test video',
        keyMoments: [],
        suggestedHashtags: [],
        bestThumbnailTimestamp: 0,
      };

      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResult) },
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });
      await adapter.analyzeVideo('https://example.com/video.webm', 'video/webm');

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            fileData: expect.objectContaining({ mimeType: 'video/webm' }),
          }),
        ])
      );
    });

    it('should throw on invalid URL', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(adapter.analyzeVideo('')).rejects.toThrow('Invalid video URL');
    });
  });

  describe('generateCopy', () => {
    const validOptions = {
      material: {
        summary: 'Test product summary',
        keyPoints: ['point 1', 'point 2'],
        keywords: ['test', 'product'],
      },
      platform: 'TWITTER' as const,
      maxLength: 280,
    };

    it('should generate copy and return result', async () => {
      const mockResult = {
        content: 'Check out our new product! #test',
        hashtags: ['test'],
        estimatedEngagement: 'medium',
        reasoning: 'Engaging hook',
      };

      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResult) },
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });
      const result = await adapter.generateCopy(validOptions);

      expect(result).toEqual(mockResult);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: GEMINI_MODELS.default });
    });

    it('should include brand context in prompt', async () => {
      const mockResult = {
        content: 'Test',
        hashtags: [],
        estimatedEngagement: 'low',
      };

      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResult) },
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });
      await adapter.generateCopy({
        ...validOptions,
        brandVoice: 'Professional',
        toneKeywords: ['friendly', 'informative'],
        targetAudience: 'Developers',
      });

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs).toContain('Brand voice: Professional');
      expect(callArgs).toContain('Tone: friendly, informative');
      expect(callArgs).toContain('Target audience: Developers');
    });

    it('should throw on missing material summary', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(
        adapter.generateCopy({
          ...validOptions,
          material: { summary: '', keyPoints: [], keywords: [] },
        })
      ).rejects.toThrow('Material summary is required');
    });

    it('should throw on missing platform', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(
        adapter.generateCopy({
          ...validOptions,
          platform: '' as 'TWITTER',
        })
      ).rejects.toThrow('Platform is required');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding and return values', async () => {
      const mockEmbedding = Array(EMBEDDING_DIMENSION).fill(0.1);

      mockEmbedContent.mockResolvedValue({
        embedding: { values: mockEmbedding },
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });
      const result = await adapter.generateEmbedding('Test text');

      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(EMBEDDING_DIMENSION);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: GEMINI_MODELS.embedding });
    });

    it('should throw on empty text', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(adapter.generateEmbedding('')).rejects.toThrow(
        'Text input is required and cannot be empty'
      );
    });

    it('should throw on whitespace-only text', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(adapter.generateEmbedding('   ')).rejects.toThrow(
        'Text input is required and cannot be empty'
      );
    });

    it('should throw on unexpected embedding dimension', async () => {
      mockEmbedContent.mockResolvedValue({
        embedding: { values: [0.1, 0.2, 0.3] }, // Wrong dimension
      });

      const adapter = new GeminiAdapter({ apiKey: 'test' });

      await expect(adapter.generateEmbedding('Test')).rejects.toThrow(
        `Unexpected embedding dimension: got 3, expected ${EMBEDDING_DIMENSION}`
      );
    });
  });
});

describe('createGeminiAdapter', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should create adapter with defaults', () => {
    const adapter = createGeminiAdapter();

    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it('should create adapter with custom API key', () => {
    const adapter = createGeminiAdapter('custom-key');

    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it('should create adapter with custom model', () => {
    const adapter = createGeminiAdapter('key', 'custom-model');

    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });
});

describe('createAIAdapter', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should create Gemini adapter', () => {
    const adapter = createAIAdapter({
      provider: 'gemini',
      apiKey: 'test-key',
    });

    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it('should throw for OpenAI (not implemented)', () => {
    expect(() =>
      createAIAdapter({
        provider: 'openai',
        apiKey: 'test-key',
      })
    ).toThrow(AIError);
    expect(() =>
      createAIAdapter({
        provider: 'openai',
        apiKey: 'test-key',
      })
    ).toThrow('OpenAI adapter not yet implemented');
  });

  it('should throw for Anthropic (not implemented)', () => {
    expect(() =>
      createAIAdapter({
        provider: 'anthropic',
        apiKey: 'test-key',
      })
    ).toThrow('Anthropic adapter not yet implemented');
  });

  it('should throw for unknown provider', () => {
    expect(() =>
      createAIAdapter({
        provider: 'unknown' as 'gemini',
        apiKey: 'test-key',
      })
    ).toThrow('Unknown AI provider: unknown');
  });
});

describe('GEMINI_MODELS', () => {
  it('should export default model constants', () => {
    expect(GEMINI_MODELS.default).toBe('gemini-2.0-flash');
    expect(GEMINI_MODELS.video).toBe('gemini-2.0-flash');
    expect(GEMINI_MODELS.embedding).toBe('text-embedding-004');
  });
});
