import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db, materials, eq, and } from '@24rabbit/database';
import {
  getPresignedUploadUrl,
  getMaterialTypeFromMime,
  ALLOWED_MIME_TYPES,
  UPLOAD_CONFIG,
} from '@/lib/storage';
import { z } from 'zod';

// Request validation schemas
const uploadRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z
    .string()
    .refine((type) => ALLOWED_MIME_TYPES.includes(type), { message: 'Unsupported file type' }),
  fileSize: z
    .number()
    .positive('File size must be positive')
    .max(
      UPLOAD_CONFIG.maxFileSize,
      `File size exceeds ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB limit`
    ),
  brandProfileId: z.string().optional(),
});

const confirmUploadSchema = z.object({
  materialId: z.string().min(1, 'Material ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      return NextResponse.json(
        { error: 'No organization selected. Please select or create an organization.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = uploadRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { filename, contentType, fileSize, brandProfileId } = validation.data;

    const { uploadUrl, fileKey, publicUrl } = await getPresignedUploadUrl(
      activeOrgId,
      filename,
      contentType
    );

    const materialType = getMaterialTypeFromMime(contentType);

    const [material] = await db
      .insert(materials)
      .values({
        organizationId: activeOrgId,
        brandProfileId: brandProfileId || null,
        type: materialType,
        name: filename,
        fileKey,
        fileSize,
        mimeType: contentType,
        url: publicUrl,
        status: 'UPLOADED',
      })
      .returning();

    return NextResponse.json({
      uploadUrl,
      fileKey,
      publicUrl,
      materialId: material.id,
    });
  } catch (error) {
    console.error('[Upload API] Presign error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}

// Confirm upload completion and trigger processing
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
    }

    const body = await request.json();
    const validation = confirmUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { materialId } = validation.data;

    // Update status with organization ownership verification
    const [updated] = await db
      .update(materials)
      .set({ status: 'PROCESSING', updatedAt: new Date() })
      .where(and(eq(materials.id, materialId), eq(materials.organizationId, activeOrgId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Material not found or access denied' }, { status: 404 });
    }

    // AI analysis is triggered by worker polling for PROCESSING status

    return NextResponse.json({ success: true, material: updated });
  } catch (error) {
    console.error('[Upload API] Confirm error:', error);
    return NextResponse.json({ error: 'Failed to confirm upload' }, { status: 500 });
  }
}
