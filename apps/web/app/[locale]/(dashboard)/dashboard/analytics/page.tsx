import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Download, TrendingUp } from 'lucide-react';

interface AnalyticsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AnalyticsPageContent />;
}

function AnalyticsPageContent() {
  const t = useTranslations('analytics');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">{t('title')}</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg hover:bg-accent transition-colors cursor-pointer">
          <Download className="h-4 w-4" />
          {t('export')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select className="px-3 py-2 bg-background border rounded-md text-sm">
          <option>{t('last7Days')}</option>
          <option>{t('last30Days')}</option>
          <option>{t('last90Days')}</option>
        </select>
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
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('totalReach')} value="12.5K" change="+15%" positive />
        <StatCard title={t('impressions')} value="45.2K" change="+8%" positive />
        <StatCard title={t('engagementRate')} value="3.2%" change="+0.5%" positive />
        <StatCard title={t('totalPosts')} value="24" change="+4" positive />
      </div>

      {/* Engagement Chart Placeholder */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-heading font-semibold mb-4">{t('engagementOverTime')}</h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Engagement chart will appear here</p>
            <p className="text-sm mt-2">Likes, Comments, Shares, Impressions over time</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Platform */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold mb-4">{t('byPlatform')}</h2>
          <div className="space-y-4">
            <BreakdownItem label="Twitter" percentage={45} color="#1DA1F2" />
            <BreakdownItem label="LinkedIn" percentage={30} color="#0077B5" />
            <BreakdownItem label="Facebook" percentage={25} color="#1877F2" />
          </div>
        </div>

        {/* By Content Angle */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold mb-4">{t('byContentAngle')}</h2>
          <div className="space-y-4">
            <BreakdownItem label="Product Focus" percentage={40} color="#2563EB" />
            <BreakdownItem label="User Benefit" percentage={30} color="#3B82F6" />
            <BreakdownItem label="Educational" percentage={20} color="#60A5FA" />
            <BreakdownItem label="Storytelling" percentage={10} color="#93C5FD" />
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-heading font-semibold mb-4">{t('topPerformingPosts')}</h2>
        <div className="space-y-4">
          <TopPostItem
            platform="Twitter"
            brand="OMECA"
            content="Upgrade your kitchen..."
            likes={245}
            comments={32}
            shares={18}
            engagement={4.2}
            daysAgo={3}
          />
          <TopPostItem
            platform="LinkedIn"
            brand="OMECA"
            content="Running a restaurant means..."
            likes={189}
            comments={28}
            shares={12}
            engagement={3.8}
            daysAgo={5}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  positive,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className={`text-sm mt-1 ${positive ? 'text-green-600' : 'text-red-600'}`}>{change}</p>
    </div>
  );
}

function BreakdownItem({
  label,
  percentage,
  color,
}: {
  label: string;
  percentage: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TopPostItem({
  platform,
  brand,
  content,
  likes,
  comments,
  shares,
  engagement,
  daysAgo,
}: {
  platform: string;
  brand: string;
  content: string;
  likes: number;
  comments: number;
  shares?: number;
  engagement: number;
  daysAgo: number;
}) {
  return (
    <div className="p-4 bg-background rounded-md border">
      <div className="flex items-center gap-2 text-sm mb-2">
        <span className="font-medium">{brand}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">{platform}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">{daysAgo} days ago</span>
      </div>
      <p className="text-sm mb-3 line-clamp-1">{content}</p>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{likes} likes</span>
        <span>{comments} comments</span>
        {shares && <span>{shares} shares</span>}
        <span className="ml-auto font-medium text-foreground">{engagement}% engagement</span>
      </div>
    </div>
  );
}
