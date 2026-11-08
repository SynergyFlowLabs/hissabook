import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hisaabook — Business, in balance',
  description: 'A clearer way to manage your business money, together. Cash, loans, owners, stock and team records in one shared, attributable ledger.',
  applicationName: 'Hisaabook',
};

export const viewport: Viewport = {
  themeColor: '#16241d',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
