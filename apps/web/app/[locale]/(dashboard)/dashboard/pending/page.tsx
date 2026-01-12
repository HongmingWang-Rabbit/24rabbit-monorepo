import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Settings, CheckCircle } from 'lucide-react';

interface PendingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PendingPage({ params }: PendingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PendingPageContent />;
}

function PendingPageContent() {
  const t = useTranslations('pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer">
            <CheckCircle className="h-4 w-4" />
            {t('bulkApprove')}
          </button>
          <button className="p-2 bg-background border rounded-md hover:bg-accent cursor-pointer">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select className="px-3 py-2 bg-background border rounded-md text-sm">
          <option>All Brands</option>
          <option>OMECA</option>
          <option>TechCo</option>
        </select>
        <select className="px-3 py-2 bg-background border rounded-md text-sm">
          <option>All Platforms</option>
          <option>Twitter</option>
          <option>LinkedIn</option>
          <option>Facebook</option>
        </select>
        <span className="text-sm text-muted-foreground ml-2">
          {t('awaitingReview', { count: 3 })}
        </span>
      </div>

      {/* Pending Posts List */}
      <div className="space-y-4">
        <PendingPostCard
          id="1"
          brand="OMECA"
          platform="Twitter"
          content="Upgrade your kitchen with OMECA's professional-grade stainless steel cookware. Built for chefs who demand quality."
          scheduledFor="Today 5:00 PM"
          expiresIn="4h 32m"
          angle="Product Focus"
        />
        <PendingPostCard
          id="2"
          brand="OMECA"
          platform="LinkedIn"
          content="Running a restaurant means making smart purchasing decisions. Here's how OMECA can help streamline your kitchen supply chain."
          scheduledFor="Tomorrow 9:00 AM"
          expiresIn="18h 15m"
          angle="Educational"
        />
        <PendingPostCard
          id="3"
          brand="TechCo"
          platform="Twitter"
          content="Ship faster, not harder. Our new CI/CD pipeline integration reduces deployment time by 80%."
          scheduledFor="Today 6:00 PM"
          expiresIn="5h 45m"
          angle="User Benefit"
        />
      </div>
    </div>
  );
}

function PendingPostCard({
  id,
  brand,
  platform,
  content,
  scheduledFor,
  expiresIn,
  angle,
}: {
  id: string;
  brand: string;
  platform: string;
  content: string;
  scheduledFor: string;
  expiresIn: string;
  angle: string;
}) {
  const t = useTranslations('pending');
  const tCommon = useTranslations('common');

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <input type="checkbox" className="mt-1 cursor-pointer" />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm mb-2">
            <span className="font-medium">{brand}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">{platform}</span>
          </div>

          <p className="text-sm mb-4">{content}</p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              {t('scheduledFor')}: {scheduledFor}
            </span>
            <span>
              {t('expiresIn')}: {expiresIn}
            </span>
            <span>
              {t('contentAngle')}: {angle}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Link
              href={`/dashboard/pending/${id}`}
              className="px-3 py-1.5 text-sm bg-background border rounded-md hover:bg-accent cursor-pointer"
            >
              Preview
            </Link>
            <button className="px-3 py-1.5 text-sm bg-background border rounded-md hover:bg-accent cursor-pointer">
              {tCommon('edit')}
            </button>
            <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer">
              {t('approve')}
            </button>
            <button className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 cursor-pointer">
              {t('reject')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
