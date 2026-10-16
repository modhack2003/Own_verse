import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/cyber/primitives';

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  tags: string[];
  publishedAt: string | null;
}

function readTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

export function BlogCard({ post, index }: { post: BlogPostSummary; index: number }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative flex h-full min-h-[380px] flex-col overflow-hidden p-6 transition-colors duration-500 hover:bg-signal hover:text-ink"
    >
      <div className="flex items-center justify-between monofont text-[10px] uppercase tracking-[0.3em] text-signal group-hover:text-ink">
        <span>TX-{String(index + 1).padStart(3, '0')}</span>
        <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</span>
      </div>

      <span aria-hidden className="mt-6 font-display text-[6rem] font-bold leading-none text-outline-red transition-all duration-500 group-hover:text-outline-ink group-hover:tracking-widest">
        {String(index + 1).padStart(2, '0')}
      </span>

      <h3 className="mt-4 font-display text-2xl font-bold uppercase leading-tight text-bone group-hover:text-ink">{post.title}</h3>
      {post.excerpt && <p className="mt-3 text-sm leading-relaxed text-muted-foreground group-hover:text-ink/80">{post.excerpt}</p>}

      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="border border-signal/40 px-2 py-0.5 monofont text-[10px] uppercase tracking-wider group-hover:border-ink/50">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-signal/30 pt-4 monofont text-[11px] uppercase tracking-[0.2em] group-hover:border-ink/40">
          <span>{post.content ? readTime(post.content) : 'Read article'}</span>
          <span className="flex items-center gap-1">
            Read More <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BlogSection({ posts, total }: { posts: BlogPostSummary[]; total: number }) {
  if (posts.length === 0) {
    return (
      <section className="border border-dashed border-signal/40 px-6 py-16 text-center">
        <p className="font-display text-3xl font-bold uppercase text-outline-red sm:text-5xl">Transmission pending</p>
        <p className="mt-4 monofont text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {'// first write-ups are being encrypted — check back soon'}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="grid gap-px border border-signal/40 bg-signal/40 md:grid-cols-3">
        {posts.map((post, i) => (
          <Reveal key={post.id} delay={i * 0.1} className="bg-background">
            <BlogCard post={post} index={i} />
          </Reveal>
        ))}
      </div>
      {total > posts.length && (
        <div className="text-center">
          <Link
            href="/blog"
            className="bracket inline-flex items-center gap-2 bg-signal/10 px-6 py-3 monofont text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal hover:text-ink"
          >
            View all {total} transmissions <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
