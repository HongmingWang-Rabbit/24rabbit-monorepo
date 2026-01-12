import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { User, Users, CreditCard, Bell, Building } from 'lucide-react';

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SettingsPageContent />;
}

function SettingsPageContent() {
  const t = useTranslations('settings');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">{t('title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SettingsCard
          href="/dashboard/settings/profile"
          icon={User}
          title={t('profile')}
          description="Manage your personal information and preferences"
        />
        <SettingsCard
          href="/dashboard/settings/organization"
          icon={Building}
          title={t('organization')}
          description="Update organization details and branding"
        />
        <SettingsCard
          href="/dashboard/settings/members"
          icon={Users}
          title={t('members')}
          description="Invite and manage team members"
        />
        <SettingsCard
          href="/dashboard/settings/billing"
          icon={CreditCard}
          title={t('billing')}
          description="Manage subscription and payment methods"
        />
        <SettingsCard
          href="/dashboard/settings/notifications"
          icon={Bell}
          title={t('notifications')}
          description="Configure email and push notifications"
        />
      </div>

      {/* Current Plan */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-heading font-semibold mb-4">{t('subscription')}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Growth Plan</p>
            <p className="text-sm text-muted-foreground">
              500 credits/month • Unlimited brands • Priority support
            </p>
          </div>
          <Link
            href="/dashboard/settings/billing"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            {t('upgrade')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-primary/10 rounded-md">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}
