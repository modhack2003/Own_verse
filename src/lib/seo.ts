import type { Metadata } from 'next';

export const SITE_URL = 'https://bikram-cyber.vercel.app';
export const SITE_NAME = 'Bikram Dey';
export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: SITE_NAME, images: [{ url: `${SITE_URL}/social-preview.jpg`, width: 1200, height: 630, alt: 'Bikram Dey — cybersecurity portfolio' }] },
    twitter: { card: 'summary_large_image', title, description, images: [`${SITE_URL}/social-preview.jpg`] },
  };
}
/** Escape markup before embedding any content-controlled text in a JSON-LD script. */
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
