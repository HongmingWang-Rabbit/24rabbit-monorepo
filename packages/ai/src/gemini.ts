import { GoogleGenerativeAI } from '@google/generative-ai';
import { PLATFORM_LIMITS } from '@24rabbit/shared';
import type {
  AIAdapter,
  ImageAnalysisResult,
  VideoAnalysisResult,
  ContentGenerationOptions,
  GeneratedCopy,
  AIAdapterOptions,
} from './types';
import { EMBEDDING_DIMENSION } from './types';
import {
  fetchImageAsBase64,
  withRetry,
  parseGeminiError,
  parseAIResponse,
  AIError,
  type RetryOptions,
} from './utils';

/** Default Gemini model configuration */
export const GEMINI_MODELS = {
  default: 'gemini-2.0-flash',
  video: 'gemini-2.0-flash',
  embedding: 'text-embedding-004',
} as const;

/** Default hashtag count per platform (conservative defaults) */
const DEFAULT_HASHTAG_COUNT = 5;

export interface GeminiModelConfig {
  default?: string;
  video?: string;
  embedding?: string;
}

export interface GeminiAdapterOptions {
  apiKey?: string;
  models?: GeminiModelConfig;
  retry?: RetryOptions;
}

export class GeminiAdapter implements AIAdapter {
  private client: GoogleGenerativeAI;
  private models: Required<GeminiModelConfig>;
  private retryOptions: RetryOptions;

  constructor(options: GeminiAdapterOptions = {}) {
    const key = options.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AIError('GEMINI_API_KEY is required', 'INVALID_API_KEY', false);
    }
    this.client = new GoogleGenerativeAI(key);
    this.models = {
      default: options.models?.default || GEMINI_MODELS.default,
      video: options.models?.video || GEMINI_MODELS.video,
      embedding: options.models?.embedding || GEMINI_MODELS.embedding,
    };
    this.retryOptions = options.retry || {};
  }

  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    this.validateUrl(imageUrl, 'image');

    return this.executeWithRetry(async () => {
      const model = this.client.getGenerativeModel({ model: this.models.default });
      const { data, mimeType } = await fetchImageAsBase64(imageUrl);

      const prompt = `Analyze this image for social media marketing purposes.
Return a JSON object with the following structure:
{
  "description": "A brief description of the image",
  "objects": ["list", "of", "main", "objects"],
  "colors": ["dominant", "colors"],
  "mood": "the overall mood/feeling",
  "suggestedHashtags": ["relevant", "hashtags", "without", "the", "hash", "symbol"]
}

Only return the JSON, no other text.`;

      const response = await model.generateContent([prompt, { inlineData: { mimeType, data } }]);

      return parseAIResponse<ImageAnalysisResult>(response.response.text());
    });
  }

  async analyzeVideo(videoUrl: string, mimeType = 'video/mp4'): Promise<VideoAnalysisResult> {
    this.validateUrl(videoUrl, 'video');

    return this.executeWithRetry(async () => {
      const model = this.client.getGenerativeModel({ model: this.models.video });

      const prompt = `Analyze this video for social media marketing purposes.
Return a JSON object with the following structure:
{
  "description": "A brief description of the video",
  "keyMoments": [{"timestamp": 0, "description": "what happens"}],
  "transcript": "speech transcript if any",
  "suggestedHashtags": ["relevant", "hashtags"],
  "bestThumbnailTimestamp": 0
}

Only return the JSON, no other text.`;

      const response = await model.generateContent([
        prompt,
        { fileData: { mimeType, fileUri: videoUrl } },
      ]);

      return parseAIResponse<VideoAnalysisResult>(response.response.text());
    });
  }

  async generateCopy(options: ContentGenerationOptions): Promise<GeneratedCopy> {
    this.validateContentOptions(options);

    return this.executeWithRetry(async () => {
      const model = this.client.getGenerativeModel({ model: this.models.default });
      const platformLimit = PLATFORM_LIMITS[options.platform];
      const maxLength = options.maxLength || platformLimit.maxChars;

      const contentDescription = [
        options.material.summary,
        options.material.keyPoints.length > 0
          ? `Key points: ${options.material.keyPoints.join('; ')}`
          : '',
        options.material.keywords.length > 0
          ? `Keywords: ${options.material.keywords.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const brandContext = [
        options.brandVoice ? `Brand voice: ${options.brandVoice}` : '',
        options.toneKeywords?.length ? `Tone: ${options.toneKeywords.join(', ')}` : '',
        options.targetAudience ? `Target audience: ${options.targetAudience}` : '',
        options.languageRules?.length ? `Language rules: ${options.languageRules.join('; ')}` : '',
        options.angle ? `Content angle/approach: ${options.angle}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const examplesSection = options.examplePosts?.length
        ? `\nExample posts for reference:\n${options.examplePosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
        : '';

      const emojiGuidance = {
        none: 'Do not use any emojis.',
        minimal: 'Use emojis sparingly, maximum 1-2.',
        moderate: 'Use emojis moderately to enhance the message.',
        heavy: 'Use emojis liberally throughout the post.',
      }[options.emojiUsage ?? 'minimal'];

      const hashtagCount = options.hashtagCount ?? DEFAULT_HASHTAG_COUNT;

      const prompt = `Generate social media copy for ${options.platform}.

CONTENT TO PROMOTE:
${contentDescription}

BRAND CONTEXT:
${brandContext}
${examplesSection}

REQUIREMENTS:
- Maximum ${maxLength} characters
- ${emojiGuidance}
- ${options.includeHashtags !== false ? `Include ${hashtagCount} relevant hashtags` : 'Do not include hashtags'}
- Engaging and platform-appropriate
- Include a call to action when appropriate

Return a JSON object:
{
  "content": "the post content with hashtags included at the end",
  "hashtags": ["used", "hashtags", "without", "hash", "symbol"],
  "estimatedEngagement": "low" | "medium" | "high",
  "reasoning": "brief explanation of why this approach was chosen"
}

Only return the JSON, no other text.`;

      const response = await model.generateContent(prompt);
      return parseAIResponse<GeneratedCopy>(response.response.text());
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.validateText(text);

    return this.executeWithRetry(async () => {
      const model = this.client.getGenerativeModel({ model: this.models.embedding });
      const result = await model.embedContent(text);
      const values = result.embedding.values;

      if (values.length !== EMBEDDING_DIMENSION) {
        throw new AIError(
          `Unexpected embedding dimension: got ${values.length}, expected ${EMBEDDING_DIMENSION}`,
          'PARSE_ERROR',
          false
        );
      }

      return values;
    });
  }

  /** Execute a function with retry and error parsing */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(async () => {
      try {
        return await fn();
      } catch (error) {
        throw parseGeminiError(error);
      }
    }, this.retryOptions);
  }

  /** Validate URL format */
  private validateUrl(url: string, type: 'image' | 'video'): void {
    if (!url || typeof url !== 'string') {
      throw new AIError(`Invalid ${type} URL: URL is required`, 'INVALID_INPUT', false);
    }
    try {
      new URL(url);
    } catch {
      throw new AIError(`Invalid ${type} URL format: ${url}`, 'INVALID_INPUT', false);
    }
  }

  /** Validate text input */
  private validateText(text: string): void {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new AIError('Text input is required and cannot be empty', 'INVALID_INPUT', false);
    }
  }

  /** Validate content generation options */
  private validateContentOptions(options: ContentGenerationOptions): void {
    if (!options.material?.summary) {
      throw new AIError('Material summary is required', 'INVALID_INPUT', false);
    }
    if (!options.platform) {
      throw new AIError('Platform is required', 'INVALID_INPUT', false);
    }
  }
}

/** Create a Gemini adapter (backwards compatible) */
export const createGeminiAdapter = (apiKey?: string, model?: string) =>
  new GeminiAdapter({ apiKey, models: model ? { default: model } : undefined });

/** Create an AI adapter based on the provider */
export function createAIAdapter(options: AIAdapterOptions): AIAdapter {
  switch (options.provider) {
    case 'gemini':
      return new GeminiAdapter({
        apiKey: options.apiKey,
        models: options.model ? { default: options.model } : undefined,
      });

    case 'openai':
      throw new AIError('OpenAI adapter not yet implemented', 'INVALID_INPUT', false);

    case 'anthropic':
      throw new AIError('Anthropic adapter not yet implemented', 'INVALID_INPUT', false);

    default:
      throw new AIError(`Unknown AI provider: ${options.provider}`, 'INVALID_INPUT', false);
  }
}
