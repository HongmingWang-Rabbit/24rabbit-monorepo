'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Image, Video, FileText, Grid, List, Upload } from 'lucide-react';
import { UploadModal } from '@/components/features/materials/upload-modal';
import { UI_MATERIAL_STATUS } from '@/lib/constants/status';

// Delay before auto-closing modal after successful upload (ms)
const UPLOAD_SUCCESS_CLOSE_DELAY_MS = 1500;

export function MaterialsPageClient() {
  const t = useTranslations('materials');
  const tFilters = useTranslations('filters');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // TODO: Fetch materials from API
  const materials: MaterialData[] = [];

  const handleUploadComplete = () => {
    // TODO: Trigger refresh of materials list via SWR mutate
    setTimeout(() => setUploadModalOpen(false), UPLOAD_SUCCESS_CLOSE_DELAY_MS);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">{t('title')}</h1>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {t('upload')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            aria-label={tFilters('filterByType')}
            className="px-3 py-2 bg-background border rounded-md text-sm"
          >
            <option value="">{tFilters('allTypes')}</option>
            <option value="IMAGE">{tFilters('images')}</option>
            <option value="VIDEO">{tFilters('videos')}</option>
            <option value="TEXT">{tFilters('text')}</option>
          </select>
          <select
            aria-label={tFilters('filterByStatus')}
            className="px-3 py-2 bg-background border rounded-md text-sm"
          >
            <option value="">{tFilters('allStatus')}</option>
            <option value="READY">{t('status.ready')}</option>
            <option value="PROCESSING">{t('status.processing')}</option>
            <option value="USED">{t('status.used')}</option>
          </select>
          {/* Brand filter - will be populated dynamically from API */}
          <select
            aria-label={tFilters('filterByBrand')}
            className="px-3 py-2 bg-background border rounded-md text-sm"
          >
            <option value="">{tFilters('allBrands')}</option>
            {/* TODO: Populate from brands API */}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            aria-label={t('gridView')}
            aria-pressed={viewMode === 'grid'}
            className={`p-2 border rounded-md cursor-pointer transition-colors ${
              viewMode === 'grid' ? 'bg-accent' : 'bg-background hover:bg-accent'
            }`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            aria-label={t('listView')}
            aria-pressed={viewMode === 'list'}
            className={`p-2 border rounded-md cursor-pointer transition-colors ${
              viewMode === 'list' ? 'bg-accent' : 'bg-background hover:bg-accent'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Materials Grid or Empty State */}
      {materials.length === 0 ? (
        <EmptyState onUploadClick={() => setUploadModalOpen(true)} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {materials.map((material) => (
            <MaterialCard key={material.id} {...material} />
          ))}
          {/* Upload Card */}
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex flex-col items-center justify-center p-4 bg-card border border-dashed rounded-lg hover:border-primary/50 transition-colors cursor-pointer aspect-square"
          >
            <Plus className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">{t('upload')}</span>
          </button>
        </div>
      )}

      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  const t = useTranslations('materials');

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 bg-muted rounded-full mb-4">
        <Upload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">{t('noMaterials')}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t('noMaterialsDescription')}</p>
      <button
        onClick={onUploadClick}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        {t('upload')}
      </button>
    </div>
  );
}

type MaterialData = {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'TEXT' | 'FILE';
  name: string;
  status: keyof typeof UI_MATERIAL_STATUS;
  brandName?: string;
  usageCount?: number;
};

function MaterialCard({ type, name, status, brandName, usageCount }: MaterialData) {
  const t = useTranslations('materials');

  const typeIcons = {
    IMAGE: Image,
    VIDEO: Video,
    TEXT: FileText,
    FILE: FileText,
  };
  const Icon = typeIcons[type];
  const statusConfig = UI_MATERIAL_STATUS[status];

  return (
    <div className="bg-card border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
      <div className="aspect-square bg-muted flex items-center justify-center">
        <Icon className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{name}</p>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.color}`}>
            {status === 'USED' && usageCount
              ? `${t(`status.${status.toLowerCase()}`)} x${usageCount}`
              : t(`status.${status.toLowerCase()}`)}
          </span>
          {brandName && <span className="text-xs text-muted-foreground">{brandName}</span>}
        </div>
      </div>
    </div>
  );
}
