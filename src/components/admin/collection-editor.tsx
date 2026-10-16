'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api, errorMessage } from './api-client';
import { Btn, EmptyState, Field, Panel, TextArea, TextInput, Toggle } from './ui';

export type FieldType = 'text' | 'textarea' | 'number' | 'tags' | 'date' | 'month' | 'url' | 'checkbox' | 'select';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
  rows?: number;
  /** choices for type "select" (an empty "—" option is added unless the field is required) */
  options?: readonly { value: string; label: string }[];
  /** initial value for new entries */
  defaultValue?: string | boolean;
  /** hide this field when the predicate is true (e.g. end date when "current") */
  hiddenWhen?: (values: FormValues) => boolean;
}

type Item = { id: string } & Record<string, unknown>;
type FormValues = Record<string, string | boolean>;

export interface CollectionEditorProps {
  title: string;
  description?: string;
  endpoint: string;
  fields: FieldDef[];
  itemTitle: (item: Item) => string;
  itemMeta?: (item: Item) => string | null | undefined;
  sort?: (a: Item, b: Item) => number;
  addLabel?: string;
}

function toFormValue(field: FieldDef, value: unknown): string | boolean {
  if (field.type === 'checkbox') return value === true;
  if (value === null || value === undefined) return '';
  if (field.type === 'tags') return Array.isArray(value) ? value.join(', ') : String(value);
  if (field.type === 'date') return String(value).slice(0, 10);
  if (field.type === 'month') return String(value).slice(0, 7);
  return String(value);
}

function toPayload(fields: FieldDef[], values: FormValues) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'checkbox') out[f.name] = v === true;
    else if (f.type === 'number') out[f.name] = v === '' ? null : Number(v);
    else if (f.type === 'tags')
      out[f.name] = String(v ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    else out[f.name] = typeof v === 'string' ? v : '';
  }
  return out;
}

function emptyValues(fields: FieldDef[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'checkbox' ? false : '')])) as FormValues;
}

export function CollectionEditor({
  title,
  description,
  endpoint,
  fields,
  itemTitle,
  itemMeta,
  sort,
  addLabel = 'Add new',
}: CollectionEditorProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>(emptyValues(fields));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await api<Item[]>(endpoint));
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => (sort ? [...items].sort(sort) : items), [items, sort]);

  const startNew = () => {
    setValues(emptyValues(fields));
    setEditing('new');
  };
  const startEdit = (item: Item) => {
    setValues(Object.fromEntries(fields.map((f) => [f.name, toFormValue(f, item[f.name])])) as FormValues);
    setEditing(item.id);
  };
  const cancel = () => setEditing(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = toPayload(fields, values);
      if (editing === 'new') {
        const created = await api<Item>(endpoint, { method: 'POST', body: payload });
        setItems((prev) => [created, ...prev]);
        toast({ title: 'Saved', description: `${itemTitle(created)} was added.` });
      } else if (editing) {
        const updated = await api<Item>(`${endpoint}/${editing}`, { method: 'PUT', body: payload });
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        toast({ title: 'Saved', description: `${itemTitle(updated)} was updated.` });
      }
      setEditing(null);
    } catch (err) {
      toast({ title: 'Not saved', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Item) => {
    if (!window.confirm(`Move "${itemTitle(item)}" to Trash? You can restore it from History & recovery.`)) return;
    setDeleting(item.id);
    try {
      await api(`${endpoint}/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      if (editing === item.id) setEditing(null);
      toast({ title: 'Deleted', description: itemTitle(item) });
    } catch (err) {
      toast({ title: 'Not deleted', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const form = (
    <form onSubmit={save} className="mb-6 border border-signal/60 bg-ink/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="monofont text-[10px] uppercase tracking-[0.3em] text-signal">
          {editing === 'new' ? `// new entry` : `// editing`}
        </span>
        <button type="button" onClick={cancel} aria-label="Cancel" className="text-muted-foreground hover:text-signal">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => {
          if (f.hiddenWhen?.(values)) return null;
          const id = `${endpoint.replace(/\W/g, '')}-${f.name}`;
          const common = {
            id,
            name: f.name,
            required: f.required,
            placeholder: f.placeholder,
          };
          const val = values[f.name];
          return (
            <Field
              key={f.name}
              label={`${f.label}${f.required ? ' *' : ''}`}
              htmlFor={id}
              hint={f.hint}
              className={f.wide || f.type === 'textarea' ? 'md:col-span-2' : undefined}
            >
              {f.type === 'textarea' ? (
                <TextArea
                  {...common}
                  rows={f.rows ?? 4}
                  value={String(val ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              ) : f.type === 'select' ? (
                <select
                  id={id}
                  name={f.name}
                  required={f.required}
                  value={String(val ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="w-full border border-signal/30 bg-ink px-3 py-2 text-sm text-bone outline-none transition-colors focus:border-signal"
                >
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'checkbox' ? (
                <div className="flex h-10 items-center">
                  <Toggle label={f.label} checked={val === true} onChange={(c) => setValues((v) => ({ ...v, [f.name]: c }))} />
                </div>
              ) : (
                <TextInput
                  {...common}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'month' ? 'month' : f.type === 'url' ? 'url' : 'text'}
                  value={String(val ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              )}
            </Field>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={cancel}>
          Cancel
        </Btn>
        <Btn type="submit" busy={saving}>
          Save
        </Btn>
      </div>
    </form>
  );

  return (
    <Panel
      title={title}
      description={description}
      actions={
        <>
          <Btn variant="ghost" size="sm" onClick={load} aria-label="Reload">
            <RefreshCw className="h-3.5 w-3.5" />
          </Btn>
          <Btn size="sm" onClick={startNew} disabled={editing === 'new'}>
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </Btn>
        </>
      }
    >
      {editing === 'new' && form}
      {loading ? (
        <p className="py-8 text-center monofont text-xs uppercase tracking-[0.3em] text-muted-foreground">loading…</p>
      ) : loadError ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Btn variant="outline" size="sm" onClick={load}>
            Retry
          </Btn>
        </div>
      ) : sorted.length === 0 && editing !== 'new' ? (
        <EmptyState>Nothing here yet — use “{addLabel}”.</EmptyState>
      ) : (
        <ul className="divide-y divide-signal/20 border-y border-signal/20">
          {sorted.map((item) =>
            editing === item.id ? (
              <li key={item.id} className="py-4">
                {form}
              </li>
            ) : (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-bone">{itemTitle(item)}</p>
                  {itemMeta?.(item) && <p className="truncate text-xs text-muted-foreground">{itemMeta(item)}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Btn variant="ghost" size="sm" onClick={() => startEdit(item)} aria-label={`Edit ${itemTitle(item)}`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(item)}
                    busy={deleting === item.id}
                    aria-label={`Delete ${itemTitle(item)}`}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Btn>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </Panel>
  );
}
