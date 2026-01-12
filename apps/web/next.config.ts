import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: [
    '@24rabbit/database',
    '@24rabbit/shared',
    '@24rabbit/ai',
    '@24rabbit/platforms',
    '@24rabbit/queue',
  ],
};

export default withNextIntl(nextConfig);
