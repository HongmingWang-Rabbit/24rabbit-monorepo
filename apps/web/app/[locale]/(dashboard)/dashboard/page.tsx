import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  CreditCard,
  Clock,
  Send,
  Sparkles,
  Upload,
  Link2,
  Calendar,
  TrendingUp,
} from 'lucide-react';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DashboardPageContent />;
}

function DashboardPageContent() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {t('welcome', { name: 'User' })}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your brands today.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('credits')}
          value="450/500"
          subtitle={t('creditsRemaining', { used: 450, total: 500 })}
          icon={CreditCard}
          trend="+10%"
        />
        <StatsCard
          title={t('pendingPosts')}
          value="3"
          subtitle={t('pendingCount', { count: 3 })}
          icon={Clock}
          href="/dashboard/pending"
        />
        <StatsCard
          title={t('postsToday')}
          value="5"
          subtitle={t('publishedCount', { count: 5 })}
          icon={Send}
          trend="+2"
        />
        <StatsCard title={t('activeBrands')} value="2" icon={Sparkles} href="/dashboard/brands" />
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-heading font-semibold mb-4">{t('quickActions')}</h2>
        <div className="flex flex-wrap gap-3">
          <QuickAction href="/dashboard/materials" icon={Upload} label={t('uploadMaterial')} />
          <QuickAction href="/dashboard/accounts" icon={Link2} label={t('connectAccount')} />
          <QuickAction href="/dashboard/brands" icon={Calendar} label={t('createSchedule')} />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Posts Preview */}
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-semibold">{t('pendingPosts')} (3)</h2>
            <Link
              href="/dashboard/pending"
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              {tCommon('viewAll')}
            </Link>
          </div>
          <div className="space-y-3">
            <PendingPostItem
              platform="Twitter"
              brand="OMECA"
              preview="Upgrade your kitchen with OMECA's professional-grade..."
              expiresIn="4h"
            />
            <PendingPostItem
              platform="LinkedIn"
              brand="OMECA"
              preview="Running a restaurant means making smart purchasing..."
              expiresIn="6h"
            />
            <PendingPostItem
              platform="Twitter"
              brand="TechCo"
              preview="Ship faster, not harder. Our new CI/CD pipeline..."
              expiresIn="8h"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-heading font-semibold mb-4">{t('recentActivity')}</h2>
          <div className="space-y-3">
            <ActivityItem type="published" message="Published to LinkedIn" time="2h ago" />
            <ActivityItem type="analyzed" message="Material analyzed" time="3h ago" />
            <ActivityItem type="pending" message="New post pending approval" time="4h ago" />
            <ActivityItem type="connected" message="Account connected" time="1d ago" />
          </div>
        </div>
      </div>

      {/* Engagement Chart Placeholder */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-heading font-semibold mb-4">{t('engagementThisWeek')}</h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Engagement chart will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-card rounded-lg border p-4 hover:border-primary/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 bg-primary/10 rounded-md">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      {trend && <p className="text-xs text-green-600 mt-2 font-medium">{trend}</p>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2 bg-background border rounded-md hover:border-primary/50 transition-colors cursor-pointer"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </Link>
  );
}

function PendingPostItem({
  platform,
  brand,
  preview,
  expiresIn,
}: {
  platform: string;
  brand: string;
  preview: string;
  expiresIn: string;
}) {
  return (
    <div className="p-3 bg-background rounded-md border">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{brand}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">{platform}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{preview}</p>
      <p className="text-xs text-muted-foreground mt-2">Expires in {expiresIn}</p>
    </div>
  );
}

function ActivityItem({
  type,
  message,
  time,
}: {
  type: 'published' | 'analyzed' | 'pending' | 'connected';
  message: string;
  time: string;
}) {
  const icons = {
    published: '✓',
    analyzed: '✓',
    pending: '●',
    connected: '✓',
  };

  const colors = {
    published: 'text-green-600',
    analyzed: 'text-green-600',
    pending: 'text-yellow-600',
    connected: 'text-green-600',
  };

  return (
    <div className="flex items-center gap-3 p-2">
      <span className={colors[type]}>{icons[type]}</span>
      <div className="flex-1">
        <p className="text-sm">{message}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}
