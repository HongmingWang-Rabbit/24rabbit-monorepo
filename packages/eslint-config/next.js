/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    './index.js',
    'next/core-web-vitals',
  ],
  rules: {
    // Next.js specific
    '@next/next/no-html-link-for-pages': 'off',
    'react/react-in-jsx-scope': 'off',
  },
  settings: {
    next: {
      rootDir: ['apps/web/'],
    },
  },
};
