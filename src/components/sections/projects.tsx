'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Star, GitFork, LayoutGrid, List } from 'lucide-react';
import { selectRepoPreview } from '@/lib/repo-preview';
import { cn } from '@/lib/utils';
import { Reveal, TiltCard } from '@/components/cyber/primitives';
import {
  LANGUAGE_COLORS,
  languageAccent,
  safeClassifyRepoObject,
  type RepoObjectInput,
} from '@/components/cyber/repo-object-kind';
import { RepoKindGlyph, SHOW_TILE_GLYPHS } from '@/components/cyber/repo-kind-glyph';

// `three` stays out of the server render and the initial page chunk — same idiom as hero.tsx.
const RepoObjectStage = dynamic(() => import('@/components/cyber/repo-object-stage').then((m) => m.RepoObjectStage), {
  ssr: false,
  loading: () => null,
});

interface Project {
  title: string;
  description: string;
  tags: string[];
  link?: string | null;
}

interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  forksCount: number;
  homepage: string | null;
  customTitle: string | null;
  customDescription: string | null;
  customTags: string[];
  displayOrder: number | null;
  readmeExcerpt?: string | null;
}

type Entry = {
  key: string;
  kind: 'project' | 'repo';
  title: string;
  description: string;
  tags: string[];
  language?: string | null;
  stars?: number;
  forks?: number;
  primaryHref?: string;
  primaryLabel: string;
  demoHref?: string | null;
  meta?: string;
  /** raw fields for the 3D object classifier — additive, nothing else reads it */
  signals: RepoObjectInput;
};

function toEntries(projects: Project[], repos: GitHubRepository[]): Entry[] {
  const a: Entry[] = projects.map((p) => ({
    key: `db-${p.title}`,
    kind: 'project',
    title: p.title,
    description: p.description,
    tags: p.tags,
    primaryHref: p.link ?? undefined,
    primaryLabel: 'View Project',
    signals: { name: p.title, description: p.description, customTags: p.tags },
  }));
  const b: Entry[] = repos.map((repo) => ({
    key: `gh-${repo.id}`,
    kind: 'repo',
    title: repo.customTitle || repo.name,
    description: repo.customDescription || repo.description || repo.readmeExcerpt || '',
    tags: repo.customTags && repo.customTags.length > 0 ? repo.customTags : repo.topics,
    language: repo.language,
    stars: repo.stargazersCount,
    forks: repo.forksCount,
    primaryHref: repo.htmlUrl,
    primaryLabel: 'View on GitHub',
    demoHref: repo.homepage,
    meta: repo.fullName,
    // the classifier needs the bare fields, not the flattened display values above
    signals: {
      name: repo.name,
      description: repo.customDescription || repo.description,
      readmeExcerpt: repo.readmeExcerpt,
      language: repo.language,
      topics: repo.topics,
      customTags: repo.customTags,
    },
  }));
  return [...a, ...b];
}

function ProjectActions({ entry, onDetails }: { entry: Entry; onDetails: () => void }) {
  const safe = (href?: string | null) => href && /^(https?:\/\/|\/(?!\/))/.test(href) ? href : undefined;
  return <div className="flex flex-wrap gap-4 border-x border-b border-signal/25 bg-card px-6 py-4 monofont text-xs text-signal lg:hidden">
    {safe(entry.primaryHref) && <a href={safe(entry.primaryHref)} target="_blank" rel="noopener noreferrer" aria-label={`${entry.kind === 'repo' ? 'Source' : 'Visit'}: ${entry.title}`}>{entry.kind === 'repo' ? 'Source' : 'Visit'}</a>}
    {safe(entry.demoHref) && <a href={safe(entry.demoHref)} target="_blank" rel="noopener noreferrer" aria-label={`Demo: ${entry.title}`}>Demo</a>}
    <a href="#project-preview" onClick={onDetails} aria-label={`Details: ${entry.title}`}>Details</a>
  </div>;
}

// The per-language colour map lives with the classifier so the CSS dot and the 3D accent agree.
const langColor = (lang?: string | null) => (lang && LANGUAGE_COLORS[lang]) || 'hsl(var(--cyan))';

// Deterministic pseudo-random from a string, so a repo's "commit graph" is stable per repo.
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The contribution-style activity grid. Unchanged markup: it is still the sizing reference and the
 * fallback whenever the 3D object cannot run (safe mode, reduced motion, no WebGL, chunk not loaded),
 * in which case the card looks exactly as it did before the 3D object existed.
 */
function ActivityGrid({ entry, index, color, dimmed }: { entry?: Entry; index: number; color: string; dimmed: boolean }) {
  const cells = useMemo(() => {
    const rand = seeded(entry?.key ?? `slot-${index}`);
    const weight = entry?.kind === 'repo' ? 0.55 : 0.35;
    return Array.from({ length: 7 * 12 }, () => {
      const r = rand();
      return r > 1 - weight ? Math.min(4, 1 + Math.floor(rand() * 4)) : 0;
    });
  }, [entry?.key, entry?.kind, index]);

  return (
    <div className={cn('relative grid grid-cols-12 gap-[3px] transition-opacity duration-500', dimmed && 'opacity-0')}>
      {cells.map((level, i) => (
        <span
          key={i}
          className="aspect-square w-full rounded-[1px] transition-colors duration-500"
          style={{
            backgroundColor: level === 0 ? 'hsl(var(--signal) / 0.1)' : color,
            opacity: level === 0 ? 1 : 0.35 + level * 0.16,
            transitionDelay: `${(i % 12) * 12}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Repo preview graphic — same GitHub-flavoured panel, with a contextual 3D object rendered into the
 * activity block: an ESP32 board for a firmware repo, bat + ball + trophy for the cricket repo, an
 * extruded stack badge for an ordinary code repo. The object is chosen from the repo's own metadata.
 */
function RepoGraphic({ entry, index, total }: { entry?: Entry; index: number; total: number }) {
  const kind = useMemo(() => safeClassifyRepoObject(entry?.signals), [entry?.signals]);
  const accent = languageAccent(entry?.language);
  const [objectLive, setObjectLive] = useState(false);
  const onStatus = useCallback((status: 'live' | 'fallback') => setObjectLive(status === 'live'), []);

  const color = langColor(entry?.language);
  const isRepo = entry?.kind === 'repo';

  return (
    <div className="relative flex h-44 flex-col justify-between overflow-hidden border-b border-signal/40 bg-ink/40 p-4" aria-hidden>
      {/* the 3D object sits behind the crosshair overlay and is inert to pointer/touch input */}
      <RepoObjectStage kind={kind} accent={accent} onStatus={onStatus} className="pointer-events-none absolute inset-0" />
      <div aria-hidden className="grid-cross pointer-events-none absolute inset-0 opacity-30" />

      {/* header: language dot + name + slot */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`lang-${entry?.key ?? index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 monofont text-[10px] uppercase tracking-[0.25em] text-bone/80">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {entry?.language || (isRepo ? 'repo' : 'field project')}
          </div>
          <span className="monofont text-[10px] uppercase tracking-[0.3em] text-signal">
            {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* contribution-style activity grid — fades out once the object is live, keeps its box either way */}
      <ActivityGrid entry={entry} index={index} color={color} dimmed={objectLive} />

      {/* footer: stars / forks for repos, tag count for field projects */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`stats-${entry?.key ?? index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 flex items-center justify-between monofont text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {isRepo ? (
            <>
              <span className="inline-flex items-center gap-1 text-signal">
                <Star className="h-3 w-3" />
                {entry?.stars ?? 0}
              </span>
              <span className="inline-flex items-center gap-1 text-signal">
                <GitFork className="h-3 w-3" />
                {entry?.forks ?? 0}
              </span>
              <span className="text-cyan">{'// commit_map'}</span>
            </>
          ) : (
            <>
              <span className="text-signal">{'// field_project'}</span>
              <span className="text-cyan">{entry?.tags.length ?? 0} tags</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function ProjectsSection({ projects, githubRepos }: { projects: Project[]; githubRepos: GitHubRepository[] }) {
  const all = useMemo(() => toEntries(projects, githubRepos), [projects, githubRepos]);
  const [showAll, setShowAll] = useState(false);
  const repoTotal = githubRepos.length;
  const previewRepos = useMemo(() => selectRepoPreview(githubRepos), [githubRepos]);
  const hiddenRepos = repoTotal - previewRepos.length;
  // Hand-picked projects and every pinned repo remain reachable in the compact view.
  const entries = useMemo(() => {
    if (showAll) return all;
    const keys = new Set(previewRepos.map((repo) => `gh-${repo.id}`));
    return all.filter((e) => e.kind === 'project' || keys.has(e.key));
  }, [all, showAll, previewRepos]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [active, setActive] = useState(0);
  const current = entries[active];

  if (entries.length === 0) {
    return (
      <section className="border border-dashed border-signal/40 p-10 text-center monofont text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {'// no payloads deployed yet'}
      </section>
    );
  }

  return (
    <section className="grid gap-10 lg:grid-cols-[340px_1fr]">
      {/* preview panel */}
      <aside id="project-preview" tabIndex={-1} className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
        <div className="clip-notch border border-signal/50 bg-card">
          <div className="flex items-center justify-between border-b border-signal/40 px-4 py-3 monofont text-[10px] uppercase tracking-[0.3em] text-signal">
            <span>{'// preview'}</span>
            <span>
              {String(active + 1).padStart(2, '0')}/{String(entries.length).padStart(2, '0')}
            </span>
          </div>
          {/* not keyed on the entry: remounting this block would recreate the WebGL canvas on every
              selection, so the 0.25s crossfade lives on the chrome rows inside it instead */}
          <RepoGraphic entry={current} index={active} total={entries.length} />
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.key}
                initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                transition={{ duration: 0.3 }}
                className="space-y-4 p-5"
              >
                <p className="monofont text-[10px] uppercase tracking-[0.3em] text-cyan">
                  {current.kind === 'repo' ? 'git_repository' : 'field_project'}
                  {current.language ? ` · ${current.language}` : ''}
                </p>
                <h3 className="font-display text-2xl font-bold uppercase leading-tight text-bone">{current.title}</h3>
                {current.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{current.description}</p>
                ) : (
                  <p className="monofont text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">{'// source code on github'}</p>
                )}
                {current.kind === 'repo' && (
                  <div className="grid grid-cols-2 border border-signal/30 monofont text-xs">
                    <div className="border-r border-signal/30 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">stars</div>
                      <div className="mt-1 flex items-center gap-1 text-signal"><Star className="h-3 w-3" />{current.stars}</div>
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">forks</div>
                      <div className="mt-1 flex items-center gap-1 text-signal"><GitFork className="h-3 w-3" />{current.forks}</div>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  {current.primaryHref && (
                    <a
                      href={current.primaryHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bracket inline-flex items-center gap-2 bg-signal px-4 py-2 monofont text-[11px] uppercase tracking-[0.15em] text-ink transition-colors hover:bg-bone"
                    >
                      {current.primaryLabel} <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                  {current.demoHref && (
                    <a
                      href={current.demoHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bracket inline-flex items-center gap-2 px-4 py-2 monofont text-[11px] uppercase tracking-[0.15em] text-cyan transition-colors hover:bg-cyan hover:text-ink"
                    >
                      Live Demo
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* collection */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <span className="monofont text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            payload_collection [{entries.length}/{all.length}]
          </span>
          <div className="flex border border-signal/40">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 monofont text-[10px] uppercase tracking-[0.25em] transition-colors',
                  view === v ? 'bg-signal text-ink' : 'text-muted-foreground hover:text-signal'
                )}
              >
                {v === 'grid' ? <LayoutGrid className="h-3 w-3" /> : <List className="h-3 w-3" />}
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {entries.map((e, i) => (
              <Reveal key={e.key} delay={(i % 4) * 0.06}>
                <TiltCard max={8}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    aria-pressed={active === i}
                    aria-controls="project-preview"
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'bracket group relative flex h-full min-h-[240px] w-full flex-col overflow-hidden border bg-card p-6 text-left transition-colors duration-300',
                      active === i ? 'border-signal text-signal' : 'border-signal/25 text-signal/40 hover:border-signal/70'
                    )}
                  >
                    <span aria-hidden className="pointer-events-none absolute -right-2 -top-6 font-display text-[7rem] font-bold leading-none text-outline-red opacity-20 transition-opacity group-hover:opacity-50">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="monofont text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      {e.kind === 'repo' ? 'repo' : 'project'} / {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-4 font-display text-2xl font-bold uppercase leading-tight text-bone" style={{ transform: 'translateZ(30px)' }}>
                      {e.title}
                    </h3>
                    {e.description ? (
                      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{e.description}</p>
                    ) : (
                      <p className="mt-3 monofont text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">{'// classified — see source'}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      {e.tags.map((t) => (
                        <span key={t} className="border border-signal/40 px-2 py-0.5 monofont text-[10px] uppercase tracking-wider text-bone/80">
                          {t}
                        </span>
                      ))}
                      {e.language && (
                        <span className="border border-cyan/50 px-2 py-0.5 monofont text-[10px] uppercase tracking-wider text-cyan">
                          {e.language}
                        </span>
                      )}
                    </div>
                    {e.kind === 'repo' && (
                      <div className="mt-4 flex items-center gap-4 monofont text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{e.stars}</span>
                        <span className="inline-flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{e.forks}</span>
                      </div>
                    )}
                    {/* additive only: absolute + pointer-events-none in existing empty corner space,
                        so no tile content moves and the tile keeps its dimensions */}
                    {SHOW_TILE_GLYPHS && (
                      <RepoKindGlyph
                        kind={safeClassifyRepoObject(e.signals)}
                        className="pointer-events-none absolute right-4 top-16 h-16 w-16 text-bone/[0.14] transition-colors duration-300 group-hover:text-cyan/30"
                      />
                    )}
                  </button>
                  <ProjectActions entry={e} onDetails={() => setActive(i)} />
                </TiltCard>
              </Reveal>
            ))}
          </div>
        ) : (
          <ul className="border-t border-signal/40">
            {entries.map((e, i) => (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-pressed={active === i}
                  aria-controls="project-preview"
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'group grid w-full grid-cols-[3rem_1fr_auto] items-center gap-4 border-b border-signal/40 px-2 py-5 text-left transition-colors',
                    active === i ? 'bg-signal text-ink' : 'hover:bg-signal/10'
                  )}
                >
                  <span className="monofont text-xs">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="block font-display text-xl font-bold uppercase">{e.title}</span>
                    <span className={cn('block truncate text-xs', active === i ? 'text-ink/70' : 'text-muted-foreground')}>
                      {e.tags.join(' · ')}
                      {e.language ? ` · ${e.language}` : ''}
                    </span>
                  </span>
                  <span className="monofont text-[10px] uppercase tracking-widest">
                    {e.kind === 'repo' ? `★ ${e.stars}` : 'field'}
                  </span>
                </button>
                <ProjectActions entry={e} onDetails={() => setActive(i)} />
              </li>
            ))}
          </ul>
        )}

        {hiddenRepos > 0 && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAll((v) => !v);
                if (showAll && active >= entries.length - hiddenRepos) setActive(0);
              }}
              aria-expanded={showAll}
              className="bracket bg-signal/10 px-6 py-3 monofont text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal hover:text-ink"
            >
              {showAll ? 'Show latest only' : `Show all ${repoTotal} repositories (+${hiddenRepos})`}
            </button>
            <span className="monofont text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {showAll ? `${repoTotal} repos from github` : `${previewRepos.length} of ${repoTotal} repos · pinned + recent`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
