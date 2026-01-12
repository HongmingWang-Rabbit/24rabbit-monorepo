/**
 * Material Service
 *
 * Handles material content extraction and analysis.
 * Supports text, URL, file (PDF/DOCX), image, and video content.
 */

import type { AIAdapter } from '@24rabbit/ai';
import type { ExtractedContent, MaterialAnalysis } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('material-service');

// =============================================================================
// Material Service Interface
// =============================================================================

export interface MaterialService {
  /**
   * Extract content from material based on type
   */
  extractContent(material: MaterialData): Promise<ExtractedContent>;

  /**
   * Analyze extracted content using AI
   */
  analyzeContent(content: ExtractedContent, materialType: string): Promise<MaterialAnalysis>;
}

export interface MaterialData {
  id: string;
  type: 'TEXT' | 'URL' | 'FILE' | 'IMAGE' | 'VIDEO';
  originalContent?: string | null;
  fileKey?: string | null;
  mimeType?: string | null;
  url?: string | null;
}

// =============================================================================
// Material Service Implementation
// =============================================================================

export interface MaterialServiceDeps {
  aiAdapter: AIAdapter;
  storageUrl?: string; // Base URL for file storage (MinIO/R2)
}

/**
 * Create a material service
 */
export function createMaterialService(deps: MaterialServiceDeps): MaterialService {
  const { aiAdapter, storageUrl } = deps;

  return {
    async extractContent(material: MaterialData): Promise<ExtractedContent> {
      logger.debug('Extracting content', { materialId: material.id, type: material.type });

      switch (material.type) {
        case 'TEXT':
          return extractText(material);

        case 'URL':
          return extractUrl(material);

        case 'FILE':
          return extractFile(material, storageUrl);

        case 'IMAGE':
          return extractImage(material, aiAdapter, storageUrl);

        case 'VIDEO':
          return extractVideo(material, aiAdapter, storageUrl);

        default:
          throw new Error(`Unsupported material type: ${material.type}`);
      }
    },

    async analyzeContent(content: ExtractedContent, materialType: string): Promise<MaterialAnalysis> {
      logger.debug('Analyzing content', { materialType, textLength: content.text.length });

      // Build analysis prompt
      const prompt = buildAnalysisPrompt(content, materialType);

      // Call AI for analysis (using generateCopy as a workaround since we need text analysis)
      // In a real implementation, you might have a dedicated analyze method
      const analysisText = content.text.slice(0, 10000); // Limit input

      try {
        // For now, we'll create a structured analysis using the AI
        // This is a simplified version - in production, you'd have a dedicated analysis endpoint
        const analysis: MaterialAnalysis = {
          summary: await generateSummary(aiAdapter, analysisText),
          keyPoints: await extractKeyPoints(aiAdapter, analysisText),
          keywords: await extractKeywords(analysisText),
          contentType: detectContentType(content),
          suggestedAngles: generateSuggestedAngles(content),
          sentiment: detectSentiment(content),
        };

        logger.debug('Content analysis complete', {
          summaryLength: analysis.summary.length,
          keyPointsCount: analysis.keyPoints.length,
          keywordsCount: analysis.keywords.length,
        });

        return analysis;
      } catch (error) {
        logger.error('Content analysis failed', error);
        // Return basic analysis on failure
        return {
          summary: content.text.slice(0, 200),
          keyPoints: [],
          keywords: extractKeywords(content.text),
          contentType: 'unknown',
          suggestedAngles: [],
          sentiment: 'neutral',
        };
      }
    },
  };
}

// =============================================================================
// Content Extraction Functions
// =============================================================================

async function extractText(material: MaterialData): Promise<ExtractedContent> {
  if (!material.originalContent) {
    throw new Error('Text material has no content');
  }

  return {
    text: material.originalContent,
    metadata: {
      characterCount: material.originalContent.length,
      wordCount: material.originalContent.split(/\s+/).filter(Boolean).length,
    },
  };
}

async function extractUrl(material: MaterialData): Promise<ExtractedContent> {
  if (!material.url) {
    throw new Error('URL material has no URL');
  }

  try {
    // Fetch the URL content
    const response = await fetch(material.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 24RabbitBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Basic HTML to text extraction
    // In production, use cheerio for proper parsing
    const text = htmlToText(html);

    // Extract metadata from HTML
    const title = extractHtmlTitle(html);
    const description = extractHtmlMeta(html, 'description');

    return {
      text,
      metadata: {
        sourceUrl: material.url,
        title,
        description,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error('URL extraction failed', error, { url: material.url });
    throw error;
  }
}

async function extractFile(
  material: MaterialData,
  storageUrl?: string
): Promise<ExtractedContent> {
  if (!material.fileKey) {
    throw new Error('File material has no file key');
  }

  const mimeType = material.mimeType ?? '';

  // For now, return a placeholder - in production, implement actual file parsing
  // using libraries like pdf-parse for PDFs and mammoth for DOCX
  logger.warn('File extraction not fully implemented', {
    fileKey: material.fileKey,
    mimeType,
  });

  return {
    text: `[File content extraction pending for: ${material.fileKey}]`,
    metadata: {
      fileKey: material.fileKey,
      mimeType,
      format: mimeType.includes('pdf') ? 'pdf' : mimeType.includes('word') ? 'docx' : 'unknown',
    },
  };
}

async function extractImage(
  material: MaterialData,
  aiAdapter: AIAdapter,
  storageUrl?: string
): Promise<ExtractedContent> {
  if (!material.fileKey && !material.url) {
    throw new Error('Image material has no file key or URL');
  }

  const imageUrl = material.url ?? `${storageUrl}/${material.fileKey}`;

  try {
    // Use AI to analyze the image
    const analysis = await aiAdapter.analyzeImage(imageUrl);

    return {
      text: analysis.description,
      metadata: {
        format: 'image',
        objects: analysis.objects,
        colors: analysis.colors,
        mood: analysis.mood,
        suggestedHashtags: analysis.suggestedHashtags,
        imageUrl,
      },
    };
  } catch (error) {
    logger.error('Image analysis failed', error, { imageUrl });
    throw error;
  }
}

async function extractVideo(
  material: MaterialData,
  aiAdapter: AIAdapter,
  storageUrl?: string
): Promise<ExtractedContent> {
  if (!material.fileKey && !material.url) {
    throw new Error('Video material has no file key or URL');
  }

  const videoUrl = material.url ?? `${storageUrl}/${material.fileKey}`;

  try {
    // Use AI to analyze the video
    const analysis = await aiAdapter.analyzeVideo(videoUrl);

    return {
      text: analysis.description + (analysis.transcript ? `\n\n${analysis.transcript}` : ''),
      metadata: {
        format: 'video',
        keyMoments: analysis.keyMoments,
        transcript: analysis.transcript,
        suggestedHashtags: analysis.suggestedHashtags,
        bestThumbnailTimestamp: analysis.bestThumbnailTimestamp,
        videoUrl,
      },
    };
  } catch (error) {
    logger.error('Video analysis failed', error, { videoUrl });
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function htmlToText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? match[1].trim() : undefined;
}

function extractHtmlMeta(html: string, name: string): string | undefined {
  const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : undefined;
}

function buildAnalysisPrompt(content: ExtractedContent, materialType: string): string {
  return `Analyze the following ${materialType} content and extract key information:

CONTENT:
${content.text.slice(0, 5000)}

Please provide:
1. A 2-3 sentence summary
2. 3-7 key points
3. Relevant keywords
4. Content type classification
5. Suggested content angles for social media
6. Overall sentiment`;
}

async function generateSummary(aiAdapter: AIAdapter, text: string): Promise<string> {
  // Simplified - in production, use a dedicated summarization prompt
  return text.slice(0, 200) + (text.length > 200 ? '...' : '');
}

async function extractKeyPoints(aiAdapter: AIAdapter, text: string): Promise<string[]> {
  // Simplified - in production, use AI to extract key points
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  return sentences.slice(0, 5).map((s) => s.trim());
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction based on word frequency
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
  ]);

  const wordCounts = new Map<string, number>();
  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, '');
    if (cleaned.length > 3 && !stopWords.has(cleaned)) {
      wordCounts.set(cleaned, (wordCounts.get(cleaned) ?? 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function detectContentType(content: ExtractedContent): string {
  const text = content.text.toLowerCase();

  if (text.includes('buy') || text.includes('sale') || text.includes('discount') || text.includes('price')) {
    return 'product';
  }
  if (text.includes('announce') || text.includes('launch') || text.includes('new')) {
    return 'announcement';
  }
  if (text.includes('how to') || text.includes('guide') || text.includes('tutorial')) {
    return 'tutorial';
  }
  if (text.includes('opinion') || text.includes('think') || text.includes('believe')) {
    return 'opinion';
  }

  return 'article';
}

function generateSuggestedAngles(content: ExtractedContent): string[] {
  return [
    'Focus on the main benefit',
    'Tell a story',
    'Ask a question',
    'Share a surprising fact',
    'Make it personal',
  ];
}

function detectSentiment(content: ExtractedContent): string {
  const text = content.text.toLowerCase();
  const positiveWords = ['great', 'amazing', 'excellent', 'love', 'best', 'wonderful', 'fantastic'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (text.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (text.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}
