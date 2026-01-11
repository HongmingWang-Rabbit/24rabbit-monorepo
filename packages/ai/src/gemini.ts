import { GoogleGenerativeAI } from '@google/generative-ai';
import { PLATFORM_LIMITS, type SocialPlatform } from '@24rabbit/shared';
import type {
  AIAdapter,
  ImageAnalysisResult,
  VideoAnalysisResult,
  GenerateCopyParams,
  GeneratedCopy,
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

  async generateCopy(params: GenerateCopyParams): Promise<GeneratedCopy> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const platformLimit = PLATFORM_LIMITS[params.platform];
    const maxLength = params.maxLength || platformLimit.maxChars;

    const prompt = `Generate social media copy for ${params.platform}.

Content to promote: ${params.contentDescription}
${params.brandTone ? `Brand tone: ${params.brandTone}` : ''}
${params.targetAudience ? `Target audience: ${params.targetAudience}` : ''}
${params.hashtags?.length ? `Include these hashtags if relevant: ${params.hashtags.join(', ')}` : ''}

Requirements:
- Maximum ${maxLength} characters
- Engaging and platform-appropriate
- Include a call to action

Return a JSON object:
{
  "content": "the post content with hashtags included",
  "hashtags": ["used", "hashtags", "without", "hash"],
  "estimatedEngagement": "low" | "medium" | "high"
}

Only return the JSON, no other text.`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();
    return JSON.parse(text);
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
export const createGeminiAdapter = (apiKey?: string) =>
  new GeminiAdapter(apiKey);
