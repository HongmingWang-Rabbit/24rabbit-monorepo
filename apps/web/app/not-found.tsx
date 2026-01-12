'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.75rem', fontWeight: 'bold' }}>404</h1>
            <p style={{ marginTop: '1rem', fontSize: '1.25rem', color: '#666' }}>Page not found</p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                marginTop: '2rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#000',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
              }}
            >
              Go back home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
