import { setRequestLocale } from 'next-intl/server';
import { MaterialsPageClient } from './materials-client';

interface MaterialsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MaterialsPage({ params }: MaterialsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MaterialsPageClient />;
}
