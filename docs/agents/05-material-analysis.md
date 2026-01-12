# Material Analysis Workflow

This document describes how agents process uploaded materials, including content extraction, AI analysis, embedding generation, and status management.

## Overview

When users upload materials (text, URLs, files, images, videos), the system must:

1. Extract content from various formats
2. Analyze content using AI to generate metadata
3. Generate embeddings for similarity matching
4. Store processed data and update status

## Material Types

| Type | Source | Extraction Method |
|------|--------|-------------------|
| `TEXT` | Direct input | Use as-is |
| `URL` | Blog posts, articles | Web scraping (Cheerio/Puppeteer) |
| `FILE` | PDF, DOCX, TXT | Document parsing |
| `IMAGE` | Product photos | AI vision analysis |
| `VIDEO` | Product demos | Transcription + frame extraction |

## Analysis Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATERIAL ANALYSIS FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. UPLOAD RECEIVED                                              │
│     API receives file/URL/text                                   │
│     Create Material record (status: PROCESSING)                  │
│                           │                                       │
│                           ▼                                       │
│  2. STORE RAW CONTENT                                            │
│     Upload to MinIO/R2 (if file)                                 │
│     Store URL reference (if URL)                                 │
│                           │                                       │
│                           ▼                                       │
│  3. QUEUE ANALYSIS JOB                                           │
│     Add to content:analyze queue                                 │
│                           │                                       │
│                           ▼                                       │
│  4. CONTENT EXTRACTION                                           │
│     Extract text based on material type                          │
│     Handle extraction failures                                   │
│                           │                                       │
│                           ▼                                       │
│  5. AI ANALYSIS                                                  │
│     Call AI Adapter for content analysis                         │
│     Generate summary, key points, angles                         │
│                           │                                       │
│                           ▼                                       │
│  6. EMBEDDING GENERATION                                         │
│     Generate 768-dim vector for similarity                       │
│     Store in ContentEmbedding table                              │
│                           │                                       │
│                           ▼                                       │
│  7. UPDATE STATUS                                                │
│     Material status → READY                                      │
│     Available for content generation                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Content Extraction

### Text Materials

Direct use with minimal processing:

```typescript
async function extractText(material: Material): Promise<ExtractedContent> {
  return {
    text: material.rawContent,
    metadata: {
      characterCount: material.rawContent.length,
      wordCount: material.rawContent.split(/\s+/).length
    }
  }
}
```

### URL Materials

Web scraping with fallback strategies:

```typescript
async function extractUrl(material: Material): Promise<ExtractedContent> {
  const url = material.sourceUrl

  try {
    // Try lightweight extraction first (Cheerio)
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 24RabbitBot/1.0)' },
      timeout: 30000
    })

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove non-content elements
    $('script, style, nav, footer, header, aside').remove()

    // Extract main content
    const content = $('article, main, .content, .post-content, body')
      .first()
      .text()
      .trim()

    // Extract metadata
    const title = $('title').text() || $('h1').first().text()
    const description = $('meta[name="description"]').attr('content')
    const ogImage = $('meta[property="og:image"]').attr('content')

    return {
      text: content,
      metadata: {
        title,
        description,
        ogImage,
        sourceUrl: url,
        fetchedAt: new Date()
      }
    }
  } catch (cheerioError) {
    // Fallback to headless browser for JS-rendered content
    return await extractUrlWithPuppeteer(url)
  }
}

async function extractUrlWithPuppeteer(url: string): Promise<ExtractedContent> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    // Wait for content to render
    await page.waitForSelector('article, main, .content, body', { timeout: 10000 })

    const content = await page.evaluate(() => {
      // Remove non-content elements
      document.querySelectorAll('script, style, nav, footer, header, aside')
        .forEach(el => el.remove())

      return document.body.innerText
    })

    const title = await page.title()

    return {
      text: content,
      metadata: { title, sourceUrl: url, renderedWithJS: true }
    }
  } finally {
    await browser.close()
  }
}
```

### URL Extraction Error Handling

| Error | Handling |
|-------|----------|
| 404 Not Found | Fail permanently, notify user |
| 403 Forbidden | Retry with different User-Agent, then fail |
| Timeout | Retry up to 3 times with increasing timeout |
| SSL Error | Fail permanently, notify user |
| Paywall Detected | Fail with specific message about paywall |
| Rate Limited | Delay retry, respect Retry-After header |

### File Materials

Document parsing based on file type:

```typescript
async function extractFile(material: Material): Promise<ExtractedContent> {
  const fileUrl = material.fileUrl
  const fileBuffer = await downloadFromStorage(fileUrl)
  const mimeType = material.mimeType

  switch (mimeType) {
    case 'application/pdf':
      return await extractPdf(fileBuffer)

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractDocx(fileBuffer)

    case 'text/plain':
      return {
        text: fileBuffer.toString('utf-8'),
        metadata: { format: 'txt' }
      }

    default:
      throw new UnsupportedFormatError(`Unsupported file type: ${mimeType}`)
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedContent> {
  const pdfParse = await import('pdf-parse')

  try {
    const data = await pdfParse(buffer, {
      max: 100  // Limit to first 100 pages
    })

    return {
      text: data.text,
      metadata: {
        format: 'pdf',
        pageCount: data.numpages,
        info: data.info
      }
    }
  } catch (error) {
    // Handle corrupted or password-protected PDFs
    if (error.message.includes('password')) {
      throw new PasswordProtectedError('PDF is password protected')
    }
    throw new ExtractionError(`PDF extraction failed: ${error.message}`)
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractedContent> {
  const mammoth = await import('mammoth')

  const result = await mammoth.extractRawText({ buffer })

  return {
    text: result.value,
    metadata: {
      format: 'docx',
      warnings: result.messages
    }
  }
}
```

### Image Materials

AI vision analysis for product images:

```typescript
async function extractImage(material: Material): Promise<ExtractedContent> {
  const imageUrl = material.fileUrl

  // Call AI Adapter for vision analysis
  const analysis = await aiAdapter.analyzeImage(imageUrl)

  return {
    text: analysis.description,
    metadata: {
      format: 'image',
      objects: analysis.objects,
      colors: analysis.colors,
      mood: analysis.mood,
      suggestedHashtags: analysis.suggestedHashtags,
      textInImage: analysis.extractedText  // OCR results
    }
  }
}
```

**AI Image Analysis Output:**

```typescript
interface ImageAnalysisResult {
  description: string        // Natural language description
  objects: string[]          // Detected objects ["coffee cup", "laptop", "plant"]
  colors: string[]           // Dominant colors ["navy blue", "white", "gold"]
  mood: string               // Overall mood ["professional", "cozy", "energetic"]
  suggestedHashtags: string[] // AI-suggested hashtags
  extractedText?: string     // Any text visible in image (OCR)
  productInfo?: {
    category: string
    features: string[]
  }
}
```

### Video Materials

Transcription and frame extraction:

```typescript
async function extractVideo(material: Material): Promise<ExtractedContent> {
  const videoUrl = material.fileUrl

  // 1. Extract audio and transcribe
  const transcription = await transcribeVideo(videoUrl)

  // 2. Extract key frames for visual analysis
  const keyFrames = await extractKeyFrames(videoUrl)

  // 3. Analyze key frames with AI vision
  const frameAnalyses = await Promise.all(
    keyFrames.map(frame => aiAdapter.analyzeImage(frame.url))
  )

  // 4. Call AI for comprehensive video analysis
  const videoAnalysis = await aiAdapter.analyzeVideo(videoUrl)

  return {
    text: transcription.text,
    metadata: {
      format: 'video',
      duration: transcription.duration,
      language: transcription.language,
      keyMoments: videoAnalysis.keyMoments,
      transcript: transcription.segments,
      frameAnalyses: frameAnalyses,
      bestThumbnailTimestamp: videoAnalysis.bestThumbnailTimestamp,
      suggestedHashtags: videoAnalysis.suggestedHashtags
    }
  }
}

async function transcribeVideo(videoUrl: string): Promise<TranscriptionResult> {
  // Extract audio track
  const audioBuffer = await extractAudioTrack(videoUrl)

  // Send to transcription service (e.g., Whisper API)
  const transcription = await whisperClient.transcribe(audioBuffer, {
    language: 'auto',  // Auto-detect language
    timestamps: true,   // Include word-level timestamps
    maxDuration: 600    // 10 minute limit
  })

  return {
    text: transcription.text,
    segments: transcription.segments,
    duration: transcription.duration,
    language: transcription.language
  }
}

async function extractKeyFrames(videoUrl: string): Promise<KeyFrame[]> {
  // Use FFmpeg to extract frames at key moments
  const frames = await ffmpeg.extractFrames(videoUrl, {
    interval: 10,       // Every 10 seconds
    maxFrames: 10,      // Maximum 10 frames
    format: 'jpg',
    quality: 80
  })

  // Upload frames to temporary storage
  return await Promise.all(
    frames.map(async (frame, index) => ({
      timestamp: index * 10,
      url: await uploadToTempStorage(frame.buffer)
    }))
  )
}
```

**Video Processing Limits:**

| Constraint | Limit | Handling |
|------------|-------|----------|
| Max duration | 10 minutes | Truncate or reject |
| Max file size | 500MB | Reject with message |
| Supported formats | MP4, MOV, WebM | Convert or reject |
| Transcription timeout | 5 minutes | Retry or fail |

## AI Analysis

After content extraction, AI analyzes the content:

```typescript
async function analyzeContent(
  extractedContent: ExtractedContent,
  materialType: MaterialType
): Promise<ContentAnalysis> {
  const prompt = buildAnalysisPrompt(extractedContent, materialType)

  const response = await aiAdapter.analyze({
    prompt,
    responseFormat: 'json',
    maxTokens: 1000
  })

  return {
    summary: response.summary,
    keyPoints: response.keyPoints,
    keywords: response.keywords,
    contentType: response.contentType,
    suggestedAngles: response.suggestedAngles,
    sentiment: response.sentiment,
    targetAudience: response.targetAudience
  }
}

function buildAnalysisPrompt(content: ExtractedContent, type: MaterialType): string {
  return `
Analyze the following ${type} content and extract key information for social media content creation.

CONTENT:
${content.text.slice(0, 10000)}  // Limit to 10k chars

${content.metadata ? `METADATA: ${JSON.stringify(content.metadata)}` : ''}

Provide analysis in this JSON format:
{
  "summary": "2-3 sentence summary of the content",
  "keyPoints": ["key point 1", "key point 2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "contentType": "article|product|announcement|tutorial|opinion|news",
  "suggestedAngles": [
    "Angle 1: Focus on...",
    "Angle 2: Highlight...",
    "Angle 3: Compare to..."
  ],
  "sentiment": "positive|neutral|informative|urgent|inspirational",
  "targetAudience": "Who would be most interested in this content"
}
`
}
```

**Analysis Output:**

```typescript
interface ContentAnalysis {
  summary: string              // Brief content summary
  keyPoints: string[]          // 3-7 main points
  keywords: string[]           // 5-15 relevant keywords
  contentType: ContentType     // Classification
  suggestedAngles: string[]    // 3-5 content angles
  sentiment: Sentiment         // Overall tone
  targetAudience: string       // Audience description
}
```

## Embedding Generation

After analysis, generate embeddings for similarity matching:

```typescript
async function generateMaterialEmbedding(
  material: Material,
  analysis: ContentAnalysis
): Promise<void> {
  // Combine content for embedding
  const embeddingText = [
    analysis.summary,
    analysis.keyPoints.join(' '),
    analysis.keywords.join(' ')
  ].join(' ')

  // Generate embedding vector
  const embedding = await aiAdapter.generateEmbedding(embeddingText)

  // Store embedding
  await prisma.contentEmbedding.create({
    data: {
      materialId: material.id,
      userId: material.userId,
      brandProfileId: material.brandProfileId,
      contentType: 'material',
      embedding: embedding,  // vector(768)
      textPreview: embeddingText.slice(0, 500)
    }
  })
}
```

## Job Processor Implementation

Complete `content:analyze` processor:

```typescript
async function analyzeProcessor(job: Job<AnalyzeJobData>): Promise<void> {
  const { materialId } = job.data

  const material = await prisma.material.findUnique({
    where: { id: materialId }
  })

  if (!material) {
    throw new Error(`Material not found: ${materialId}`)
  }

  try {
    // Update progress
    await job.updateProgress(10)

    // 1. Extract content based on type
    const extractedContent = await extractContent(material)
    await job.updateProgress(40)

    // 2. Analyze with AI
    const analysis = await analyzeContent(extractedContent, material.type)
    await job.updateProgress(70)

    // 3. Generate embedding
    await generateMaterialEmbedding(material, analysis)
    await job.updateProgress(90)

    // 4. Update material with analysis results
    await prisma.material.update({
      where: { id: materialId },
      data: {
        status: 'READY',
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        keywords: analysis.keywords,
        contentType: analysis.contentType,
        suggestedAngles: analysis.suggestedAngles,
        sentiment: analysis.sentiment,
        extractedText: extractedContent.text.slice(0, 50000),  // Store first 50k chars
        metadata: extractedContent.metadata,
        analyzedAt: new Date()
      }
    })

    await job.updateProgress(100)

    logger.info('Material analysis complete', {
      materialId,
      type: material.type,
      keyPointsCount: analysis.keyPoints.length,
      keywordsCount: analysis.keywords.length
    })

  } catch (error) {
    // Update material status to failed
    await prisma.material.update({
      where: { id: materialId },
      data: {
        status: 'FAILED',
        failureReason: error.message
      }
    })

    throw error  // Re-throw for retry handling
  }
}

async function extractContent(material: Material): Promise<ExtractedContent> {
  switch (material.type) {
    case 'TEXT':
      return extractText(material)
    case 'URL':
      return extractUrl(material)
    case 'FILE':
      return extractFile(material)
    case 'IMAGE':
      return extractImage(material)
    case 'VIDEO':
      return extractVideo(material)
    default:
      throw new Error(`Unknown material type: ${material.type}`)
  }
}
```

## Concurrency & Limits

### Processing Limits

| Material Type | Concurrency | Timeout | Max Size |
|---------------|-------------|---------|----------|
| TEXT | 10 | 30s | 100KB |
| URL | 5 | 60s | N/A |
| FILE (PDF/DOCX) | 5 | 120s | 50MB |
| IMAGE | 5 | 60s | 20MB |
| VIDEO | 2 | 300s | 500MB |

### Queue Configuration

```typescript
const analyzeWorker = createWorker('content:analyze', analyzeProcessor, {
  connection,
  concurrency: 5,
  limiter: {
    max: 100,      // Max 100 jobs
    duration: 60000 // Per minute
  }
})
```

## Error Handling

### Extraction Errors

| Error Type | Retry | User Message |
|------------|-------|--------------|
| `NetworkError` | Yes (3x) | "Could not fetch content. Please try again." |
| `TimeoutError` | Yes (2x) | "Content took too long to load." |
| `UnsupportedFormatError` | No | "This file format is not supported." |
| `PasswordProtectedError` | No | "This PDF is password protected." |
| `PaywallError` | No | "This content is behind a paywall." |
| `ContentTooLargeError` | No | "File exceeds size limit." |

### Analysis Errors

| Error Type | Retry | Handling |
|------------|-------|----------|
| AI API timeout | Yes (3x) | Exponential backoff |
| AI rate limit | Yes (delay) | Wait for rate limit reset |
| Invalid AI response | Yes (2x) | Re-prompt with stricter format |
| Empty content | No | Mark as failed, notify user |

## Cleanup & Storage

### Temporary File Cleanup

```typescript
// Cleanup job runs hourly
async function cleanupTempFiles(): Promise<void> {
  const cutoff = subHours(new Date(), 24)

  // Find and delete old temp files
  const tempFiles = await storage.listFiles({
    prefix: 'temp/',
    modifiedBefore: cutoff
  })

  for (const file of tempFiles) {
    await storage.deleteFile(file.key)
  }

  logger.info('Temp file cleanup complete', { deletedCount: tempFiles.length })
}
```

### Storage Structure

```
/materials
  /{userId}
    /{materialId}
      /original.{ext}      # Original uploaded file
      /extracted.txt       # Extracted text content
      /thumbnail.jpg       # Generated thumbnail (images/videos)
      /frames/             # Video key frames
        /frame-00.jpg
        /frame-10.jpg
        ...
```

## Material Status Transitions

```
UPLOADING → PROCESSING → READY
                ↓
              FAILED
```

| Status | Description |
|--------|-------------|
| `UPLOADING` | File upload in progress |
| `PROCESSING` | Analysis job running |
| `READY` | Available for content generation |
| `FAILED` | Analysis failed, user notified |

## Credit Consumption

| Operation | Credits |
|-----------|---------|
| Text analysis | 1 |
| URL extraction + analysis | 1 |
| PDF/DOCX analysis | 1 |
| Image analysis (AI vision) | 2 |
| Video analysis (transcription + vision) | 5 |

Credits are deducted when the analysis job starts. Refunded if analysis fails due to system error (not user error like unsupported format).
