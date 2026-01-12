import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;
  const locales = Object.keys(siteConfig.locales);

  // Static pages that should be indexed
  const staticPages = ['', '/login', '/signup'];

  // Generate sitemap entries for all locales
  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : 0.8,
      });
    }
  }

  return entries;
}
