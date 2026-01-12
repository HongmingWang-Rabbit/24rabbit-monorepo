import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomePageContent />;
}

function HomePageContent() {
  const t = useTranslations('common');
  const tAuth = useTranslations('auth');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <div className="text-center">
        <h1 className="text-5xl font-heading font-bold text-foreground">{t('appName')}</h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-md">{t('tagline')}</p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            {tAuth('login')}
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 bg-cta text-cta-foreground rounded-lg font-medium hover:bg-cta/90 transition-colors"
          >
            {tAuth('signup')}
          </Link>
        </div>
      </div>
    </main>
  );
}
