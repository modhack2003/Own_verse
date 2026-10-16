import { publicMetadata, SITE_URL } from '@/lib/seo';
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
  ...publicMetadata(SITE_TITLE, SITE_DESCRIPTION, '/'),
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: ['cybersecurity', 'penetration testing', 'VAPT', 'bug bounty', 'CTF', 'red team', 'portfolio', 'Bikram Dey'],
  authors: [{ name: 'Bikram Dey' }],
  creator: 'Bikram Dey',
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
    <html lang="en" className="dark safe-mode" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem('nd-experience-mode');var r=matchMedia('(prefers-reduced-motion: reduce)').matches;document.documentElement.classList.toggle('safe-mode',r||m!=='glitch')}catch(e){}})()` }} />
        <link rel="preload" as="fetch" href={MUSIC_TRACK} crossOrigin="anonymous" fetchPriority="high" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Tektur:wght@600;700&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* Japanese UI labels use a bounded glyph subset instead of the entire CJK font. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;900&amp;display=swap&amp;text=%E3%81%8E%E3%82%8A%E3%82%A2%E3%82%AB%E3%82%AE%E3%82%AF%E3%82%B5%E3%82%BF%E3%83%83%E3%83%88%E3%83%8A%E3%83%8F%E3%83%9E%E3%83%A1%E3%83%A4%E3%83%A9%E3%83%AA%E3%83%AB%E3%83%AF%E3%83%B3%E3%83%BC%E4%B8%87%E4%B8%AD%E4%BA%86%E4%BB%8B%E4%BC%81%E4%BD%9C%E4%BE%B5%E4%BF%A1%E5%80%89%E5%81%B5%E5%85%A5%E5%85%B7%E5%86%99%E5%89%87%E5%8B%95%E5%8F%96%E5%93%81%E5%99%A8%E5%A0%82%E5%A2%83%E5%A4%A7%E5%AE%9A%E5%AF%9F%E5%B0%82%E5%B1%A5%E5%B7%B1%E5%BA%AB%E5%BC%B1%E5%BE%85%E5%BE%A1%E6%85%8B%E6%88%90%E6%89%8B%E6%8A%80%E6%8B%9B%E6%92%83%E6%94%BB%E6%95%99%E6%97%97%E6%9B%B8%E6%9E%9C%E6%A0%BC%E6%A5%AD%E6%AD%A6%E6%AD%B4%E6%AE%BF%E7%89%A9%E7%8A%B6%E7%90%86%E7%95%8C%E7%99%BA%E7%9B%A3%E7%9C%BC%E7%A8%BC%E7%AE%A1%E7%B4%B9%E7%B5%82%E7%B5%8C%E8%82%B2%E8%84%86%E8%87%AA%E8%8F%AF%E8%A1%93%E8%A6%8B%E8%A6%8F%E8%A6%96%E8%A8%80%E8%A8%98%E8%A9%A6%E8%AA%8D%E8%AA%9E%E8%B3%87%E8%B3%9E%E8%BC%AA%E9%80%9A%E9%81%93%E9%87%8D%E9%87%91%E9%8C%B2%E9%8F%A1%E9%96%80%E9%96%8B%E9%98%B2%E9%A0%86%E9%A8%93" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <a href="#main-content" className="sr-only z-[300] bg-ink p-3 text-signal focus:not-sr-only focus:fixed">Skip to content</a>
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
