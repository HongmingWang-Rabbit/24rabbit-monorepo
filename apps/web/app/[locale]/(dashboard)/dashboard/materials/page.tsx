import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Plus, Image, Video, FileText, Grid, List } from 'lucide-react';

interface MaterialsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MaterialsPage({ params }: MaterialsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MaterialsPageContent />;
}

function MaterialsPageContent() {
  const t = useTranslations('materials');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">{t('title')}</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer">
          <Plus className="h-4 w-4" />
          {t('upload')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select className="px-3 py-2 bg-background border rounded-md text-sm">
            <option>All Types</option>
            <option>Images</option>
            <option>Videos</option>
            <option>Text</option>
          </select>
          <select className="px-3 py-2 bg-background border rounded-md text-sm">
            <option>All Status</option>
            <option>{t('status.ready')}</option>
            <option>{t('status.processing')}</option>
            <option>{t('status.used')}</option>
          </select>
          <select className="px-3 py-2 bg-background border rounded-md text-sm">
            <option>All Brands</option>
            <option>OMECA</option>
            <option>TechCo</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-background border rounded-md hover:bg-accent cursor-pointer">
            <Grid className="h-4 w-4" />
          </button>
          <button className="p-2 bg-background border rounded-md hover:bg-accent cursor-pointer">
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MaterialCard type="image" name="product1.jpg" status="ready" brand="OMECA" />
        <MaterialCard type="video" name="demo.mp4" status="processing" brand="OMECA" />
        <MaterialCard type="text" name="blog.txt" status="ready" brand="TechCo" />
        <MaterialCard type="image" name="product2.jpg" status="used" usageCount={3} brand="OMECA" />
        <MaterialCard type="image" name="product3.jpg" status="uploaded" />

        {/* Upload Card */}
        <button className="flex flex-col items-center justify-center p-4 bg-card border border-dashed rounded-lg hover:border-primary/50 transition-colors cursor-pointer aspect-square">
          <Plus className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">{t('upload')}</span>
        </button>
      </div>
    </div>
  );
}

function MaterialCard({
  type,
  name,
  status,
  brand,
  usageCount,
}: {
  type: 'image' | 'video' | 'text';
  name: string;
  status: 'uploaded' | 'processing' | 'analyzed' | 'ready' | 'used' | 'archived' | 'failed';
  brand?: string;
  usageCount?: number;
}) {
  const t = useTranslations('materials');

  const icons = {
    image: Image,
    video: Video,
    text: FileText,
  };
  const Icon = icons[type];

  const statusColors = {
    uploaded: 'bg-gray-100 text-gray-700',
    processing: 'bg-blue-100 text-blue-700',
    analyzed: 'bg-green-100 text-green-700',
    ready: 'bg-green-100 text-green-700',
    used: 'bg-purple-100 text-purple-700',
    archived: 'bg-gray-100 text-gray-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
      <div className="aspect-square bg-muted flex items-center justify-center">
        <Icon className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{name}</p>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[status]}`}>
            {status === 'used' && usageCount
              ? `${t(`status.${status}`)} x${usageCount}`
              : t(`status.${status}`)}
          </span>
          {brand && <span className="text-xs text-muted-foreground">{brand}</span>}
        </div>
      </div>
    </div>
  );
}
