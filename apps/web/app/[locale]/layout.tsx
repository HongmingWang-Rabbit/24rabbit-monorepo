import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { locales, type Locale } from '@/i18n/request';
import { poppins, openSans } from '@/lib/fonts';
import { siteConfig } from '@/lib/config/site';
import '../globals.css';

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ogLocale = siteConfig.locales[locale as Locale] || 'en_US';
  const alternateLocales = Object.values(siteConfig.locales).filter((l) => l !== ogLocale);

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${siteConfig.name} - AI-Powered Social Media Automation`,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: [...siteConfig.keywords],
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    openGraph: {
      type: 'website',
      locale: ogLocale,
      alternateLocale: alternateLocales,
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: `${siteConfig.name} - AI-Powered Social Media Automation`,
      description: siteConfig.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteConfig.name} - AI-Powered Social Media Automation`,
      description: siteConfig.description,
      creator: siteConfig.twitterHandle,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${openSans.variable} font-body antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
