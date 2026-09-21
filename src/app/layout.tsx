import type { Metadata } from 'next';
import './globals.css';
import { themeBootstrap } from '@/lib/theme-script';
export const metadata: Metadata = {
  title: 'PGConnect · A better place to manage home',
  description:
    'Your PG, connected. Manage tenants, rent, meals and everyday living in one calm workspace.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
