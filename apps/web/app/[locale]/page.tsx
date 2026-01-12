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
  const tLanding = useTranslations('landing');

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-6 py-24 lg:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl lg:text-6xl font-heading font-bold text-foreground tracking-tight">
            {t('appName')}
          </h1>
          <p className="mt-6 text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto">
            {tLanding('hero.headline')}
          </p>
          <p className="mt-4 text-lg text-muted-foreground/80 max-w-xl mx-auto">
            {tLanding('hero.subheadline')}
          </p>
          <div className="mt-10 flex gap-4 justify-center flex-wrap">
            <Link
              href="/signup"
              className="px-8 py-4 bg-cta text-cta-foreground rounded-lg font-medium hover:bg-cta/90 transition-colors text-lg"
            >
              {tLanding('hero.cta')}
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors text-lg"
            >
              {tAuth('login')}
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-center text-foreground">
            {tLanding('howItWorks.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-center max-w-2xl mx-auto">
            {tLanding('howItWorks.subtitle')}
          </p>
          <div className="mt-16 grid md:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto">
                  {step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {tLanding(`howItWorks.step${step}.title`)}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {tLanding(`howItWorks.step${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-center text-foreground">
            {tLanding('features.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-center max-w-2xl mx-auto">
            {tLanding('features.subtitle')}
          </p>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              'aiGeneration',
              'multiPlatform',
              'scheduling',
              'brandVoice',
              'analytics',
              'deduplication',
            ].map((feature) => (
              <div
                key={feature}
                className="p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow"
              >
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                  <FeatureIcon feature={feature} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {tLanding(`features.${feature}.title`)}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {tLanding(`features.${feature}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground">
            {tLanding('platforms.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{tLanding('platforms.subtitle')}</p>
          <div className="mt-12 flex flex-wrap justify-center gap-6">
            {['Facebook', 'Twitter', 'LinkedIn', 'Instagram'].map((platform) => (
              <div
                key={platform}
                className="px-6 py-3 bg-card border border-border rounded-lg text-foreground font-medium"
              >
                {platform}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{tLanding('platforms.comingSoon')}</p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground">
            {tLanding('cta.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{tLanding('cta.subtitle')}</p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="px-10 py-4 bg-cta text-cta-foreground rounded-lg font-medium hover:bg-cta/90 transition-colors text-lg inline-block"
            >
              {tLanding('cta.button')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {tLanding('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {tLanding('footer.privacy')}
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {tLanding('footer.terms')}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureIcon({ feature }: { feature: string }) {
  const icons: Record<string, React.ReactNode> = {
    aiGeneration: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    multiPlatform: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
    scheduling: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    brandVoice: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        />
      </svg>
    ),
    analytics: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    deduplication: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  };

  return icons[feature] || null;
}
