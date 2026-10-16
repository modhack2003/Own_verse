/** @jest-environment node */
import { blogFilters, blogHref, getBlogPage, BLOG_SUMMARY_SELECT } from '../blog-list';
import { prisma } from '../prisma';
jest.mock('../prisma', () => ({ prisma: { blogPost: { count: jest.fn(), findMany: jest.fn() } } }));
test('filters keep untrusted query text literal, bound pages, and preserve filters in navigation', () => {
  const query = blogFilters({ q: '  [.*]  ', tag: 'Web', page: '-8' });
  expect(query.page).toBe(1);
  expect(query.where).toEqual({ published: true, OR: [{ title: { contains: '[.*]', mode: 'insensitive' } }, { excerpt: { contains: '[.*]', mode: 'insensitive' } }], tags: { has: 'Web' } });
  expect(blogFilters({ page: '99999999' }).page).toBe(100000);
  expect(blogHref(2, 'a & b', 'Web')).toBe('/blog?q=a+%26+b&tag=Web&page=2');
});
test('listing only selects summaries and clamps a stale page after posts are removed', async () => {
  jest.mocked(prisma.blogPost.count).mockResolvedValue(15);
  jest.mocked(prisma.blogPost.findMany).mockResolvedValue([]);
  const result = await getBlogPage({ page: '99' });
  expect(result).toMatchObject({ page: 2, pages: 2, total: 15 });
  expect(prisma.blogPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 12, skip: 12, select: BLOG_SUMMARY_SELECT }));
  expect(BLOG_SUMMARY_SELECT).not.toHaveProperty('content');
});
