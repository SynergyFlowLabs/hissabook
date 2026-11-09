import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/archivo-black';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import './globals.css';

const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://hissabook-eta.vercel.app';

const SITE_TITLE = 'Hisaabook — Business, in balance';
const SITE_DESCRIPTION =
  'A clearer way to manage your business money, together. Cash, loans, owners, stock and team records in one shared, attributable ledger — built for Pakistani businesses.';

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: {
    default: SITE_TITLE,
    template: '%s — Hisaabook',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Hisaabook',
  generator: 'Next.js',
  keywords: [
    'hissabook',
    'hisaabook',
    'hisaab kitaab',
    'bookkeeping app Pakistan',
    'khata app',
    'business ledger',
    'small business accounting Pakistan',
    'shop inventory tracker',
    'loan and udhaar tracker',
    'owner equity tracker',
    'team salary manager',
    'expense tracker Pakistan',
  ],
  authors: [{ name: 'SynergyFlow Labs', url: 'https://github.com/SynergyFlowLabs' }],
  creator: 'SynergyFlow Labs',
  publisher: 'SynergyFlow Labs',
  category: 'business',
  classification: 'Business software',
  referrer: 'origin-when-cross-origin',
  formatDetection: { telephone: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_PK',
    url: '/',
    siteName: 'Hisaabook',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Hisaabook',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-precomposed.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [{ rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#c9f24f' }],
  },
  other: {
    'msapplication-TileColor': '#16241d',
    'msapplication-TileImage': '/icons/icon-512.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9ede7' },
    { media: '(prefers-color-scheme: dark)', color: '#16241d' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
