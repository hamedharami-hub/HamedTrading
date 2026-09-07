import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Hamed Trading Lab',
  description: 'سامانه شخصی تحلیل و معامله آزمایشی cTrader برای ویندوز و اندروید',
  applicationName: 'TradingLab',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TradingLab',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Hamed Trading Lab',
    description: 'سامانه شخصی تحلیل و معامله آزمایشی cTrader برای ویندوز و اندروید',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hamed Trading Lab',
    description: 'سامانه شخصی تحلیل و معامله آزمایشی cTrader برای ویندوز و اندروید',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body suppressHydrationWarning className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
