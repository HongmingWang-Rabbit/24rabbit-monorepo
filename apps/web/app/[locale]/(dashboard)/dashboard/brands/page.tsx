import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Plus, Sparkles } from 'lucide-react';

interface BrandsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BrandsPage({ params }: BrandsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BrandsPageContent />;
}

function BrandsPageContent() {
  const t = useTranslations('brands');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">{t('title')}</h1>
        <Link
          href="/dashboard/brands/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {t('createBrand')}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Example Brand Cards */}
        <BrandCard
          name="OMECA"
          accounts={3}
          postsPerWeek={12}
          colors={['#2563EB', '#3B82F6', '#F97316']}
        />
        <BrandCard
          name="TechCo"
          accounts={2}
          postsPerWeek={5}
          colors={['#10B981', '#6366F1', '#F59E0B']}
        />

        {/* Add Brand Card */}
        <Link
          href="/dashboard/brands/new"
          className="flex flex-col items-center justify-center p-6 bg-card border border-dashed rounded-lg hover:border-primary/50 transition-colors cursor-pointer min-h-[200px]"
        >
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">{t('createBrand')}</span>
        </Link>
      </div>
    </div>
  );
}

function BrandCard({
  name,
  accounts,
  postsPerWeek,
  colors,
}: {
  name: string;
  accounts: number;
  postsPerWeek: number;
  colors: string[];
}) {
  const t = useTranslations('brands');

  return (
    <Link
      href={`/dashboard/brands/${name.toLowerCase()}`}
      className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-lg">{name}</h3>
          <div className="flex gap-1 mt-2">
            {colors.map((color, i) => (
              <div key={i} className="w-6 h-6 rounded" style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t space-y-1">
        <p className="text-sm text-muted-foreground">
          {t('connectedAccounts', { count: accounts })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('postsPerWeek', { count: postsPerWeek })}
        </p>
      </div>
    </Link>
  );
}
