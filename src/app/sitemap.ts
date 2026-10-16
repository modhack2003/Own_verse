import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // An unavailable database must not replace the last good sitemap with a partial one.
  const posts = await prisma.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } });
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.8 },
    ...posts.map(post => ({ url: `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`, lastModified: post.updatedAt, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
