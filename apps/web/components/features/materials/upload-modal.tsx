'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import {
  Upload,
  X,
  FileImage,
  FileVideo,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { UPLOAD_CONFIG } from '@/lib/constants/storage';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

type FileUploadState = {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
  materialId?: string;
};

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const t = useTranslations('materials');
  const tCommon = useTranslations('common');
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': UPLOAD_CONFIG.allowedImageTypes.map((t) => `.${t.split('/')[1]}`),
      'video/*': UPLOAD_CONFIG.allowedVideoTypes.map((t) => `.${t.split('/')[1]}`),
      'text/*': ['.txt', '.md'],
      'application/pdf': ['.pdf'],
    },
    maxSize: UPLOAD_CONFIG.maxFileSize,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (fileState: FileUploadState, index: number) => {
    const { file } = fileState;

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: 'uploading' as const, progress: 0 } : f))
    );

    try {
      // Step 1: Get presigned URL
      const presignResponse = await fetch('/api/materials/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadUrl, materialId } = await presignResponse.json();

      // Update progress to 20%
      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, progress: 20 } : f)));

      // Step 2: Upload to S3/MinIO
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Update progress to 80%
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, progress: 80, status: 'processing' as const } : f
        )
      );

      // Step 3: Confirm upload
      const confirmResponse = await fetch('/api/materials/upload', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      });

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error || 'Failed to confirm upload');
      }

      // Success
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, progress: 100, status: 'success' as const, materialId } : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      );
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);

    // Upload all pending files
    const pendingFiles = files
      .map((f, index) => ({ ...f, index }))
      .filter((f) => f.status === 'pending');

    await Promise.all(pendingFiles.map((f) => uploadFile(f, f.index)));

    setIsUploading(false);

    // Check if all uploads succeeded
    const allSucceeded = files.every((f) => f.status === 'success' || f.status === 'pending');
    if (allSucceeded && onUploadComplete) {
      onUploadComplete();
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      onOpenChange(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return FileImage;
    if (type.startsWith('video/')) return FileVideo;
    return FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('uploadMaterials')}</DialogTitle>
        </DialogHeader>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium">{t('dragDrop')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('supportedFormats')}</p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((fileState, index) => {
              const Icon = getFileIcon(fileState.file.type);
              return (
                <div
                  key={`${fileState.file.name}-${index}`}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <Icon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileState.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(fileState.file.size)}
                      </span>
                      {fileState.status === 'uploading' && (
                        <Progress value={fileState.progress} className="h-1 flex-1 max-w-24" />
                      )}
                      {fileState.status === 'processing' && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('status.processing')}
                        </span>
                      )}
                      {fileState.status === 'success' && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {t('status.uploaded')}
                        </span>
                      )}
                      {fileState.status === 'error' && (
                        <span className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fileState.error}
                        </span>
                      )}
                    </div>
                  </div>
                  {fileState.status === 'pending' && !isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-muted rounded cursor-pointer"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Status Summary */}
        {files.length > 0 && (successCount > 0 || errorCount > 0) && (
          <div className="flex items-center gap-4 text-sm">
            {successCount > 0 && (
              <span className="text-green-600">{t('uploadedCount', { count: successCount })}</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-600">{t('failedCount', { count: errorCount })}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
          >
            {tCommon('close')}
          </button>
          <button
            onClick={handleUpload}
            disabled={pendingCount === 0 || isUploading}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isUploading ? tCommon('loading') : `${t('upload')} (${pendingCount})`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
