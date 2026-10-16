import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const BLOG_PAGE_SIZE = 12;
export const BLOG_SUMMARY_SELECT = { id: true, title: true, slug: true, excerpt: true, tags: true, publishedAt: true } as const;
export function blogFilters(input: { q?: string | string[]; tag?: string | string[]; page?: string | string[] }) {
  const text = (value: string | string[] | undefined, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const q = text(input.q, 120), tag = text(input.tag, 80);
  const rawPage = text(input.page, 8);
  const page = /^\d+$/.test(rawPage) ? Math.min(100000, Math.max(1, Number(rawPage))) : 1;
  const where: Prisma.BlogPostWhereInput = { published: true,
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }] } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
  };
  return { q, tag, page, where };
}
export function blogHref(page: number, q = '', tag = '') {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);
  if (page > 1) params.set('page', String(page));
  return `/blog${params.size ? `?${params}` : ''}`;
}
export async function getBlogPage(input: Parameters<typeof blogFilters>[0]) {
  const filters = blogFilters(input);
  const total = await prisma.blogPost.count({ where: filters.where });
  const pages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const page = Math.min(pages, filters.page);
  const posts = await prisma.blogPost.findMany({ where: filters.where, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * BLOG_PAGE_SIZE, take: BLOG_PAGE_SIZE, select: BLOG_SUMMARY_SELECT });
  return { ...filters, page, pages, total, posts: posts.map(post => ({ ...post, publishedAt: post.publishedAt?.toISOString() ?? null })) };
}
