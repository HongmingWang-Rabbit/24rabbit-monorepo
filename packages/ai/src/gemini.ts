import { GoogleGenerativeAI } from '@google/generative-ai';
import { PLATFORM_LIMITS, type SocialPlatform } from '@24rabbit/shared';
import type {
  AIAdapter,
  ImageAnalysisResult,
  VideoAnalysisResult,
  ContentGenerationOptions,
  GeneratedCopy,
  AIAdapterOptions,
} from './types';

export class GeminiAdapter implements AIAdapter {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey?: string, model = 'gemini-1.5-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.client = new GoogleGenerativeAI(key);
    this.model = model;
  }

  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    const model = this.client.getGenerativeModel({ model: this.model });

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

    const response = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageUrl, // In production, fetch and convert to base64
        },
      },
    ]);

    const text = response.response.text();
    return JSON.parse(text);
  }

  async analyzeVideo(videoUrl: string): Promise<VideoAnalysisResult> {
    // Video analysis requires Gemini 1.5 Pro with video support
    const model = this.client.getGenerativeModel({
      model: 'gemini-1.5-pro',
    });

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
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: videoUrl,
        },
      },
    ]);

    const text = response.response.text();
    return JSON.parse(text);
  }

  async generateCopy(options: ContentGenerationOptions): Promise<GeneratedCopy> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const platformLimit = PLATFORM_LIMITS[options.platform];
    const maxLength = options.maxLength || platformLimit.maxChars;

    // Build content description from material
    const contentDescription = [
      options.material.summary,
      options.material.keyPoints.length > 0 ? `Key points: ${options.material.keyPoints.join('; ')}` : '',
      options.material.keywords.length > 0 ? `Keywords: ${options.material.keywords.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    // Build brand context
    const brandContext = [
      options.brandVoice ? `Brand voice: ${options.brandVoice}` : '',
      options.toneKeywords?.length ? `Tone: ${options.toneKeywords.join(', ')}` : '',
      options.targetAudience ? `Target audience: ${options.targetAudience}` : '',
      options.languageRules?.length ? `Language rules: ${options.languageRules.join('; ')}` : '',
      options.angle ? `Content angle/approach: ${options.angle}` : '',
    ].filter(Boolean).join('\n');

    // Build examples section
    const examplesSection = options.examplePosts?.length
      ? `\nExample posts for reference:\n${options.examplePosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : '';

    // Emoji guidance
    const emojiGuidance = {
      none: 'Do not use any emojis.',
      minimal: 'Use emojis sparingly, maximum 1-2.',
      moderate: 'Use emojis moderately to enhance the message.',
      heavy: 'Use emojis liberally throughout the post.',
    }[options.emojiUsage ?? 'minimal'];

    const prompt = `Generate social media copy for ${options.platform}.

CONTENT TO PROMOTE:
${contentDescription}

BRAND CONTEXT:
${brandContext}
${examplesSection}

REQUIREMENTS:
- Maximum ${maxLength} characters
- ${emojiGuidance}
- ${options.includeHashtags !== false ? `Include ${options.hashtagCount ?? 5} relevant hashtags` : 'Do not include hashtags'}
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
    const text = response.response.text();

    // Clean up potential markdown code blocks
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedText);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel({
      model: 'text-embedding-004',
    });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}

// Default export for convenience
export const createGeminiAdapter = (apiKey?: string, model?: string) =>
  new GeminiAdapter(apiKey, model);

/**
 * Create an AI adapter based on the provider
 * Currently only Gemini is implemented, but this abstraction allows
 * easy switching to other providers (OpenAI, Anthropic, etc.)
 */
export function createAIAdapter(options: AIAdapterOptions): AIAdapter {
  switch (options.provider) {
    case 'gemini':
      return new GeminiAdapter(options.apiKey, options.model);

    case 'openai':
      // TODO: Implement OpenAI adapter
      throw new Error('OpenAI adapter not yet implemented');

    case 'anthropic':
      // TODO: Implement Anthropic adapter
      throw new Error('Anthropic adapter not yet implemented');

    default:
      throw new Error(`Unknown AI provider: ${options.provider}`);
  }
}
