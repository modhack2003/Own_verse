'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api-client';
import { Btn, Panel } from './ui';

const MODELS = ['PersonalData', 'Project', 'Skill', 'Certificate', 'Education', 'Experience', 'CtfEvent', 'GitHubRepository', 'BlogPost', 'BountyFinding', 'SiteAudioConfig'];
type Revision = { id: string; model: string; recordId: string; action: string; actor: string; label: string; createdAt: string; before?: unknown; after?: unknown };
type Detail = { revision: Revision; current: unknown; expected: string };
export function HistoryPanel() {
  const loadSequence = useRef(0);
  const [model, setModel] = useState('');
  const [trash, setTrash] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Revision[]; total: number } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [backup, setBackup] = useState<unknown>();
  const [preview, setPreview] = useState<{ records: number; collections: { model: string; count: number }[] } | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setData(null); setDetail(null); setError('');
    try {
      const result = await api<{ items: Revision[]; total: number }>(`/api/admin/history?model=${model}&page=${page}&trash=${trash}`, { signal });
      if (!signal?.aborted && sequence === loadSequence.current) setData(result);
    } catch (error) { if (!signal?.aborted && sequence === loadSequence.current) setError(errorMessage(error)); }
  }, [model, page, trash]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const restore = (side: 'before' | 'after') => {
    if (!detail || !window.confirm(`Restore ${detail.revision.label} to the selected ${side} version? Current content will receive an undo revision.`)) return;
    void run(async () => {
      await api('/api/admin/history', { method: 'POST', body: { id: detail.revision.id, side, expected: detail.expected } });
      await load(); setNotice('Version restored. Refresh the corresponding editor to see the updated record.');
    });
  };
  return <Panel title="History & recovery" description="Content edits are recorded atomically. Deleted content stays in Trash until restored; no permanent deletion is offered here.">
    {error && <p role="alert" className="mb-4 text-sm text-signal">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-cyan">{notice}</p>}
    <div className="mb-5 flex flex-wrap gap-3">
      <Btn variant={trash ? 'outline' : 'primary'} onClick={() => { setData(null); setDetail(null); setTrash(false); setModel(''); setPage(1); }}>Audit history</Btn>
      <Btn variant={trash ? 'primary' : 'outline'} onClick={() => { setData(null); setDetail(null); setTrash(true); setModel('BlogPost'); setPage(1); }}>Trash</Btn>
      <label className="text-sm">Collection <select aria-label="History collection" value={model} onChange={event => { setModel(event.target.value); setPage(1); }} className="border border-signal/40 bg-ink p-2">{!trash && <option value="">All collections</option>}{MODELS.map(name => <option key={name}>{name}</option>)}</select></label>
      <Btn variant="outline" busy={busy} onClick={() => void load()}>Refresh history</Btn>
    </div>
    {!data && !error && <p role="status">Loading history…</p>}
    {data && <>
      <p className="mb-3 text-xs text-muted-foreground">{data.total} records · Page {page}</p>
      {!data.items.length && <p>No {trash ? 'deleted content' : 'revisions'} yet.</p>}
      <ul className="divide-y divide-signal/20">{data.items.map(item => <li key={item.id || item.recordId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{item.label}</strong><p className="text-xs text-muted-foreground">{item.model} · {item.action} · {new Date(item.createdAt).toLocaleString()} · {item.actor}</p></div><Btn variant="outline" disabled={!item.id || busy} onClick={() => void run(async () => setDetail(await api(`/api/admin/history?id=${item.id}`)))}>Review version</Btn></li>)}</ul>
      <div className="mt-4 flex gap-3"><Btn variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous history</Btn><Btn variant="outline" disabled={page * 30 >= data.total} onClick={() => setPage(value => value + 1)}>Next history</Btn></div>
    </>}
    {detail && <section aria-label="Revision comparison" className="my-6 space-y-4 border border-signal/40 p-4">
      <h3 className="font-display text-xl">Review: {detail.revision.label}</h3>
      {(['current', 'before', 'after'] as const).map(side => <details key={side}><summary className="cursor-pointer text-signal">{side === 'current' ? 'Current record' : `${side} this change`}</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-3 text-xs">{JSON.stringify(side === 'current' ? detail.current : detail.revision[side], null, 2)}</pre></details>)}
      <div className="flex flex-wrap gap-3"><Btn disabled={!detail.revision.before || busy} onClick={() => restore('before')}>Restore before version</Btn><Btn variant="outline" disabled={!detail.revision.after || busy} onClick={() => restore('after')}>Restore after version</Btn><Btn variant="ghost" onClick={() => setDetail(null)}>Close comparison</Btn></div>
    </section>}
    <section className="mt-10 space-y-4 border-t border-signal/40 pt-6">
      <h3 className="font-display text-2xl">Content backups</h3>
      <p className="text-sm text-muted-foreground">Download content and the Security Insights import ledger, including drafts, Trash and private bounty findings. Keep this file private. Credentials, sessions, messages, client requests and old revision history are excluded. Uploaded media stays at its existing URL.</p>
      <p className="text-xs text-muted-foreground">Maximum 1,000 records / 3 MB. Restore merges by ID, preserves records absent from the file and records every overwrite in history. Use database backups for larger or complete disaster recovery.</p>
      <Btn variant="outline" busy={busy} onClick={() => void run(async () => {
        const file = await api('/api/admin/backup');
        const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `own-verse-content-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Download content backup</Btn>
      <label className="block text-sm">Choose content backup<input aria-label="Choose content backup" type="file" accept="application/json,.json" className="mt-2 block w-full text-xs" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; setPreview(null); setBackup(undefined);
        if (!file) return;
        void run(async () => {
          if (file.size > 3_000_000) throw new Error('Backup too large (max 3 MB).');
          const value: unknown = JSON.parse(await file.text());
          const checked = await api<{ records: number; collections: { model: string; count: number }[] }>('/api/admin/backup?preview=true', { method: 'POST', body: value });
          setBackup(value); setPreview(checked);
        });
      }} /></label>
      {preview && <div role="status"><p>{preview.records} records validated. No changes applied.</p><ul className="mt-2 text-xs text-muted-foreground">{preview.collections.filter(item => item.count).map(item => <li key={item.model}>{item.model}: {item.count}</li>)}</ul></div>}
      <Btn disabled={!preview || busy} onClick={() => {
        if (!window.confirm('Merge this backup into current content? Matching IDs will be overwritten and saved in history.')) return;
        void run(async () => { const result = await api<{ restored: number }>('/api/admin/backup', { method: 'POST', body: backup }); setPreview(null); setBackup(undefined); await load(); setNotice(`${result.restored} records restored. Refresh the relevant editors.`); });
      }}>Restore validated backup</Btn>
    </section>
  </Panel>;
}
