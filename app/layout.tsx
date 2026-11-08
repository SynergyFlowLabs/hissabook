import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hisaabook — Business, in balance',
  description: 'A clearer way to manage your business money, together.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
