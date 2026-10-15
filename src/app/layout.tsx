import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { getFooterData } from "@/lib/portfolio-data";
import { ExperienceGate } from "@/components/cyber/experience-gate";
import { SiteAudio } from '@/components/cyber/site-audio';
import { MUSIC_TRACK } from '@/lib/site-audio-library';
import { CyberCursor } from "@/components/cyber/cyber-cursor";

const SITE_TITLE = 'Bikram Dey | Hack. Secure. Defend.';
const SITE_DESCRIPTION =
  'Cybersecurity analyst & penetration tester. VAPT services, bug bounty hall of fame, projects, CTF operations and write-ups.';

export const metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: ['cybersecurity', 'penetration testing', 'VAPT', 'bug bounty', 'CTF', 'red team', 'portfolio', 'Bikram Dey'],
  authors: [{ name: 'Bikram Dey' }],
  creator: 'Bikram Dey',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: 'Bikram Dey',
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
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport = {
  themeColor: '#12141c',
};

export const revalidate = 60;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const footerData = await getFooterData();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preload" as="fetch" href={MUSIC_TRACK} crossOrigin="anonymous" fetchPriority="high" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Tektur:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+JP:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ExperienceGate />
        <CyberCursor />
        <SiteAudio />
        {/* CRT overlays (scanlines + grain) */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] scanline opacity-[0.35] mix-blend-multiply" />
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] noise opacity-[0.05]" />
        {children}
        <SiteFooter personalData={footerData} />
        <Toaster />
      </body>
    </html>
  );
}
