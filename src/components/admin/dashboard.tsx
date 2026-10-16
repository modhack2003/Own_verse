'use client';

import { HistoryPanel } from './history-panel';

import { useEffect, useState, type ComponentType } from 'react';
import {
  Award,
  Briefcase,
  Bug,
  FileText,
  Flag,
  FolderGit2,
  Github,
  GraduationCap,
  Handshake,
  Inbox,
  LogOut,
  ShieldCheck,
  Upload,
  User,
  Wrench,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from './api-client';
import { CollectionEditor, type CollectionEditorProps } from './collection-editor';
import { ProfilePanel } from './profile-panel';
import { SkillsPanel } from './skills-panel';
import { InsightsPanel } from './insights-panel';
import { GitHubPanel } from './github-panel';
import { InboxPanel } from './inbox-panel';
import { ImportPanel } from './import-panel';
import { SecurityPanel } from './security-panel';
import { AudioPanel } from './audio-panel';
import { RequestsPanel } from './requests-panel';
import { CURRENCIES, FINDING_PLATFORMS, SEVERITIES, formatMoney } from '@/lib/bounty';
import { Btn } from './ui';

type Item = Parameters<CollectionEditorProps['itemTitle']>[0];

const monthYear = (v: unknown) => {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const opts = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

const COLLECTIONS: Record<string, CollectionEditorProps> = {
  bounties: {
    title: 'Bug bounty findings',
    description:
      'Shown in the Hall of Fame on the site. Tick “Private program” to hide the program name and link publicly — keep the summary free of identifying details too.',
    endpoint: '/api/bounties',
    addLabel: 'Add finding',
    fields: [
      { name: 'title', label: 'Finding title', type: 'text', required: true, wide: true, placeholder: 'Stored XSS in account settings' },
      { name: 'program', label: 'Program / company', type: 'text', required: true, placeholder: 'Acme Corp VDP' },
      { name: 'platform', label: 'Platform', type: 'select', options: opts(FINDING_PLATFORMS) },
      { name: 'severity', label: 'Severity', type: 'select', required: true, defaultValue: 'medium', options: SEVERITIES.map((s) => ({ value: s.id, label: s.label })) },
      { name: 'vulnType', label: 'Vulnerability type', type: 'text', placeholder: 'IDOR, XSS, SSRF…' },
      { name: 'bounty', label: 'Bounty amount', type: 'number', hint: 'Whole number, leave empty if none' },
      { name: 'currency', label: 'Currency', type: 'select', defaultValue: 'USD', options: opts(CURRENCIES) },
      { name: 'date', label: 'Date reported / rewarded', type: 'date' },
      { name: 'cve', label: 'CVE', type: 'text', placeholder: 'CVE-2025-12345' },
      { name: 'link', label: 'Public link', type: 'url', hint: 'Disclosed report or hall of fame page (hidden for private programs)', wide: true },
      { name: 'hallOfFame', label: 'Hall of fame / acknowledgement', type: 'checkbox' },
      { name: 'privateProgram', label: 'Private program (hide name + link)', type: 'checkbox' },
      { name: 'description', label: 'Public summary', type: 'textarea', rows: 3 },
    ],
    itemTitle: (i: Item) => String(i.title),
    itemMeta: (i: Item) =>
      [
        String(i.severity ?? '').toUpperCase(),
        i.privateProgram ? `${i.program} (private)` : i.program,
        typeof i.bounty === 'number' && i.bounty > 0 ? formatMoney(i.bounty, i.currency as string | null) : null,
        monthYear(i.date),
      ]
        .filter(Boolean)
        .join(' · '),
    sort: (a: Item, b: Item) => new Date(String(b.date ?? b.createdAt ?? 0)).getTime() - new Date(String(a.date ?? a.createdAt ?? 0)).getTime(),
  },
  experience: {
    title: 'Experience',
    description: 'Jobs, internships and freelance work. Importable from LinkedIn.',
    endpoint: '/api/experience',
    addLabel: 'Add role',
    fields: [
      { name: 'role', label: 'Role / title', type: 'text', required: true },
      { name: 'company', label: 'Company', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'current', label: 'I currently work here', type: 'checkbox' },
      { name: 'startDate', label: 'Start', type: 'month' },
      { name: 'endDate', label: 'End', type: 'month', hiddenWhen: (v) => v.current === true },
      { name: 'description', label: 'Description', type: 'textarea', rows: 5 },
    ],
    itemTitle: (i: Item) => `${i.role} · ${i.company}`,
    itemMeta: (i: Item) => `${monthYear(i.startDate) || '?'} — ${i.current ? 'Present' : monthYear(i.endDate) || '?'}${i.source === 'linkedin' ? ' · from LinkedIn' : ''}`,
    sort: (a: Item, b: Item) =>
      Number(b.current === true) - Number(a.current === true) ||
      new Date(String(b.startDate ?? 0)).getTime() - new Date(String(a.startDate ?? 0)).getTime(),
  },
  projects: {
    title: 'Projects',
    description: 'Hand-picked projects shown before your GitHub repos.',
    endpoint: '/api/projects',
    addLabel: 'Add project',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'link', label: 'Link', type: 'url', placeholder: 'https://…' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'tags', label: 'Tags', type: 'tags', hint: 'Comma separated', wide: true },
    ],
    itemTitle: (i: Item) => String(i.title),
    itemMeta: (i: Item) => (Array.isArray(i.tags) ? i.tags.join(' · ') : ''),
  },
  ctf: {
    title: 'CTF competitions',
    endpoint: '/api/ctf',
    addLabel: 'Add CTF',
    fields: [
      { name: 'name', label: 'Event name', type: 'text', required: true },
      { name: 'organizer', label: 'Organizer', type: 'text' },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'placement', label: 'Placement', type: 'text', placeholder: 'Top 10% / Rank #42' },
      { name: 'team', label: 'Team', type: 'text' },
      { name: 'points', label: 'Points', type: 'number' },
      { name: 'categories', label: 'Categories', type: 'tags', hint: 'Web, Crypto, Forensics…' },
      { name: 'writeupUrl', label: 'Write-up URL', type: 'url' },
    ],
    itemTitle: (i: Item) => String(i.name),
    itemMeta: (i: Item) => [i.organizer, String(i.date ?? '').slice(0, 10), i.placement].filter(Boolean).join(' · '),
  },
  education: {
    title: 'Education',
    endpoint: '/api/education',
    addLabel: 'Add education',
    fields: [
      { name: 'institution', label: 'Institution', type: 'text', required: true },
      { name: 'degree', label: 'Degree', type: 'text' },
      { name: 'duration', label: 'Duration', type: 'text', placeholder: '2021 - 2025' },
    ],
    itemTitle: (i: Item) => String(i.institution),
    itemMeta: (i: Item) => [i.degree, i.duration].filter(Boolean).join(' · '),
  },
  certificates: {
    title: 'Certificates',
    endpoint: '/api/certificates',
    addLabel: 'Add certificate',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'issuer', label: 'Issuer', type: 'text' },
      { name: 'year', label: 'Year', type: 'number' },
      { name: 'url', label: 'Credential URL', type: 'url' },
    ],
    itemTitle: (i: Item) => String(i.name),
    itemMeta: (i: Item) => [i.issuer, i.year].filter(Boolean).join(' · '),
  },
  blog: {
    title: 'Blog posts',
    description: 'Drafts are hidden from the homepage and /blog. To make a post visible, open Edit, enable Published, and Save. Content supports simple Markdown (# headings, **bold**, lists, `code`, links).',
    endpoint: '/api/blog',
    addLabel: 'New post',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
      { name: 'slug', label: 'URL slug', type: 'text', hint: 'Leave empty to generate from the title' },
      { name: 'published', label: 'Published', type: 'checkbox' },
      { name: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2 },
      { name: 'content', label: 'Content (Markdown)', type: 'textarea', rows: 14 },
      { name: 'tags', label: 'Tags', type: 'tags', wide: true },
    ],
    itemTitle: (i: Item) => String(i.title),
    itemMeta: (i: Item) => `${i.published ? 'Published · visible on site' : i.archivedAt ? 'Archived · retained here' : 'Draft · hidden from site'} · /blog/${i.slug}`,
  },
};

type TabId =
  | 'profile'
  | 'experience'
  | 'projects'
  | 'github'
  | 'ctf'
  | 'bounties'
  | 'education'
  | 'certificates'
  | 'skills'
  | 'blog'
  | 'requests'
  | 'inbox'
  | 'import'
  | 'security'
  | 'audio'
  | 'history';

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'experience', label: 'Experience', icon: Briefcase },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'ctf', label: 'CTF', icon: Flag },
  { id: 'bounties', label: 'Bug bounty', icon: Bug },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'audio', label: 'Site audio', icon: Volume2 },
  { id: 'history', label: 'History & recovery', icon: FileText },
  { id: 'requests', label: 'Requests', icon: Handshake },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'import', label: 'LinkedIn import', icon: Upload },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

interface SessionInfo {
  expiresAt: string;
  pin: { source: string; weak: boolean };
}

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [blogVersion, setBlogVersion] = useState(0);
  const [tab, setTab] = useState<TabId>('profile');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [unread, setUnread] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const badge = (id: TabId) => (id === 'inbox' ? unread : id === 'requests' ? newRequests : 0);

  // keep an eye on the session so an expired one is noticed without a failed save
  useEffect(() => {
    const check = () =>
      api<SessionInfo>('/api/admin/session')
        .then(setSession)
        .catch(() => {});
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api<{ read: boolean }[]>('/api/messages')
      .then((m) => setUnread(m.filter((x) => !x.read).length))
      .catch(() => {});
    api<{ status: string }[]>('/api/engagements')
      .then((r) => setNewRequests(r.filter((x) => x.status === 'new').length))
      .catch(() => {});
  }, []);

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 border-b border-signal/40 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="monofont text-[10px] uppercase tracking-[0.35em] text-signal">{'// control_room'}</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none text-bone sm:text-5xl">
            Admin <span className="text-outline-red">console</span>
          </h1>
          {session && (
            <p className="mt-2 monofont text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              session ends {new Date(session.expiresAt).toLocaleString()} · changes go live within ~1 min
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a href="/" target="_blank" className="border border-signal/40 px-4 py-2.5 monofont text-[11px] uppercase tracking-[0.18em] text-signal hover:bg-signal hover:text-ink">
            View site
          </a>
          <Btn variant="outline" onClick={onLogout}>
            <LogOut className="h-3.5 w-3.5" /> Log out
          </Btn>
        </div>
      </div>

      {session?.pin.weak && tab !== 'security' && (
        <button
          type="button"
          onClick={() => setTab('security')}
          className="mb-6 w-full border border-signal bg-signal/10 px-4 py-3 text-left text-sm text-bone hover:bg-signal/20"
        >
          Your PIN is weak. <u>Set a stronger 6–12 digit PIN in Security ›</u>
        </button>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* mobile tab picker */}
        <select
          aria-label="Section"
          value={tab}
          onChange={(e) => setTab(e.target.value as TabId)}
          className="border border-signal/40 bg-ink px-3 py-2.5 monofont text-xs uppercase tracking-[0.2em] text-bone lg:hidden"
        >
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
              {badge(t.id) ? ` (${badge(t.id)})` : ''}
            </option>
          ))}
        </select>

        <nav className="hidden flex-col border border-signal/40 lg:flex" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 border-b border-signal/20 px-4 py-3 text-left monofont text-[11px] uppercase tracking-[0.18em] transition-colors last:border-b-0',
                tab === t.id ? 'bg-signal text-ink' : 'text-muted-foreground hover:bg-signal/10 hover:text-bone'
              )}
            >
              <t.icon className="h-4 w-4" />
              <span className="flex-1">{t.label}</span>
              {badge(t.id) > 0 && (
                <span className={cn('px-1.5 text-[10px]', tab === t.id ? 'bg-ink text-signal' : 'bg-signal text-ink')}>{badge(t.id)}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="min-w-0" aria-label={active.label}>
          {tab === 'profile' && <ProfilePanel />}
          {tab === 'skills' && <SkillsPanel />}
          {tab === 'github' && <GitHubPanel />}
          {tab === 'inbox' && <InboxPanel onUnreadChange={setUnread} />}
          {tab === 'requests' && <RequestsPanel onNewCountChange={setNewRequests} />}
          {tab === 'import' && <ImportPanel />}
          {tab === 'security' && <SecurityPanel onLogout={onLogout} />}
          {tab === 'audio' && <AudioPanel />}
          {tab === 'history' && <HistoryPanel />}
          {tab === 'blog' && <InsightsPanel onImported={() => setBlogVersion(v => v + 1)} />}
          {tab in COLLECTIONS && <CollectionEditor key={`${tab}-${blogVersion}`} {...COLLECTIONS[tab]} />}
        </div>
      </div>
    </div>
  );
}
