import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: '#1a3a2a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'MyGolf-Digital',
  description: 'Your Digital Golf Home - Club Management & Scoring Platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MyGolf',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'apple-touch-icon', url: '/apple-touch-icon.png' }],
  },
  openGraph: {
    title: 'MyGolf-Digital',
    description: 'Your Digital Golf Home - Club Management & Scoring Platform',
    url: 'https://mygolf-digital.co.za',
    siteName: 'MyGolf-Digital',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MyGolf-Digital - Your Digital Golf Home',
      },
    ],
    locale: 'en_ZA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyGolf-Digital',
    description: 'Your Digital Golf Home - Club Management & Scoring Platform',
    images: ['/og-image.png'],
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* PWA splash / mobile chrome */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MyGolf" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${mono.variable} font-sans antialiased`}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content">
          {children}
        </main>
        <Analytics />
        {/* Service worker registration - only register if not already registered */}
        <Script id="register-sw" strategy="afterInteractive">{`
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            // Only register once - check if already registered
            navigator.serviceWorker.getRegistration().then(function(registration) {
              if (!registration) {
                // Only register if not already registered
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.warn('Service worker registration failed:', err);
                });
              }
            });
          }
        `}</Script>
      </body>
    </html>
  )
}
