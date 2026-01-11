/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@24rabbit/database',
    '@24rabbit/shared',
    '@24rabbit/ai',
    '@24rabbit/platforms',
    '@24rabbit/queue',
  ],
};

module.exports = nextConfig;
