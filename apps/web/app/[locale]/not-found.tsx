import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-heading font-bold text-foreground">404</h1>
        <p className="mt-4 text-xl text-muted-foreground">{t('pageNotFound')}</p>
        <Link
          href="/"
          className="inline-block mt-8 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          {tCommon('back')}
        </Link>
      </div>
    </div>
  );
}
