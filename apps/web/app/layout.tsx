import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '24Rabbit - AI-Powered Social Media Automation',
  description: 'Fully automated 24/7 social media marketing powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
