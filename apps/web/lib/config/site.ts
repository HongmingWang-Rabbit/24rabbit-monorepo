export const siteConfig = {
  name: '24Rabbit',
  description:
    'AI-powered social media automation platform. Upload materials or connect e-commerce sites, and AI automatically generates and publishes content to Facebook, Twitter, LinkedIn, and more - 24/7.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://24rabbit.com',
  twitterHandle: '@24rabbit',
  keywords: [
    'social media automation',
    'AI content generation',
    'social media marketing',
    'content scheduling',
    'automated posting',
    'Facebook automation',
    'Twitter automation',
    'LinkedIn automation',
    'Instagram automation',
    'e-commerce marketing',
    'AI marketing',
    'brand voice AI',
    'social media management',
    'content deduplication',
    'multi-platform publishing',
    'social analytics',
    'automated social media',
    '24/7 posting',
    'AI copywriting',
    'social media scheduler',
  ],
  locales: {
    en: 'en_US',
    zh: 'zh_CN',
    fr: 'fr_FR',
    ru: 'ru_RU',
    es: 'es_ES',
    de: 'de_DE',
  },
} as const;

export type SiteConfig = typeof siteConfig;
