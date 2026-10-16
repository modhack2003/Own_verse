import Link from 'next/link';
import { HeaderNav } from '@/components/header-nav';
import { SectionHeader } from '@/components/cyber/primitives';
import { BlogCard } from '@/components/sections/blog';
import { getFooterData, getHiddenSections } from '@/lib/portfolio-data';
import { blogFilters, blogHref, getBlogPage } from '@/lib/blog-list';
import { publicMetadata } from '@/lib/seo';

type Props = { searchParams: Promise<{ q?: string | string[]; tag?: string | string[]; page?: string | string[] }> };
export async function generateMetadata({ searchParams }: Props) {
  const filters = blogFilters(await searchParams);
  return { ...publicMetadata('Security Insights | Bikram Dey', 'Write-ups and notes on offensive security, CTFs and secure engineering.', blogHref(filters.page, filters.q, filters.tag)),
    ...(filters.q || filters.tag ? { robots: { index: false, follow: true } } : {}),
  };
}
export default async function BlogIndex({ searchParams }: Props) {
  const [result, personal, hidden] = await Promise.all([getBlogPage(await searchParams), getFooterData(), getHiddenSections()]);
  const { posts, total, page, pages, q, tag } = result;
  return <div className="flex min-h-screen flex-col">
    <HeaderNav personalData={personal} hidden={hidden} solid />
    <main id="main-content" tabIndex={-1} className="relative flex-1">
      <div aria-hidden className="grid-cross pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-[1440px] space-y-10 px-6 pb-28 pt-36 sm:px-10">
        <h1 className="sr-only">Security Insights</h1>
        <SectionHeader index={String(total).padStart(2, '0')} jp="記録" eyebrow="Archive / Transmissions" title="Security Insights" subtitle="Published write-ups, newest first. Search titles and summaries or filter by an exact tag." />
        <form action="/blog" className="flex flex-wrap items-end gap-4 border border-signal/40 p-4">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">Search articles<input name="q" defaultValue={q} maxLength={120} className="border border-signal/40 bg-ink p-3 text-bone" type="search" /></label>
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">Tag<input name="tag" defaultValue={tag} maxLength={80} placeholder="e.g. CISA KEV" className="border border-signal/40 bg-ink p-3 text-bone" /></label>
          <button className="bg-signal px-5 py-3 text-ink" type="submit">Search</button>
          {(q || tag) && <Link href="/blog" className="p-3 text-signal">Clear filters</Link>}
        </form>
        <p role="status" className="monofont text-xs text-muted-foreground">{total} articles · Page {page} of {pages}</p>
        {posts.length === 0 ? <p className="border border-dashed border-signal/40 px-6 py-16 text-center text-muted-foreground">No articles match. Try another search or clear the filters.</p> :
          <div className="grid gap-px border border-signal/40 bg-signal/40 md:grid-cols-2 lg:grid-cols-3">{posts.map((post, index) => <div key={post.id} className="bg-background"><BlogCard post={post} index={(page - 1) * 12 + index} /></div>)}</div>}
        <nav aria-label="Article pages" className="flex justify-between text-signal">
          {page > 1 ? <Link rel="prev" href={blogHref(page - 1, q, tag)}>Previous page</Link> : <span />}
          {page < pages && <Link rel="next" href={blogHref(page + 1, q, tag)}>Next page</Link>}
        </nav>
      </div>
    </main>
  </div>;
}
