import './globals.css';
import './v4.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata = {
  title: 'OASIS — See it. Claim it. Share it.',
  description:
    'OASIS is a zero-install PWA for UPNVJT: see which coworking tables are free, claim one in seconds, and find study partners who share your working style.',
  manifest: '/manifest.webmanifest',
  applicationName: 'OASIS',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'OASIS — Open Academic Space and Interaction System',
    description: 'See it. Claim it. Share it. A calmer way to find a seat at UPNVJT.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#0f1210',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/instrument-sans.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
