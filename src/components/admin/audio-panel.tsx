'use client';

import { useEffect, useState } from 'react';
import { AUDIO_SETTINGS_EVENT, DEFAULT_AUDIO_SETTINGS, DIALOGUES, parseAudioSettings, type AudioSettings } from '@/lib/site-audio-library';
import { api, errorMessage } from './api-client';
import { Btn, Field, Panel, TextInput, Toggle } from './ui';

export function AudioPanel() {
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    try { setSettings(parseAudioSettings(await api('/api/site-audio'))); setError(null); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    if (!settings) return;
    setBusy(true); setNotice(null);
    try {
      setSettings(parseAudioSettings(await api('/api/site-audio', { method: 'PUT', body: settings })));
      window.dispatchEvent(new Event(AUDIO_SETTINGS_EVENT));
      setNotice('Audio settings saved for all visitors. Open pages refresh within one minute.'); setError(null);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return <Panel title="Site audio" description="Control the theme, character dialogue, and Sharingan effects for the whole site. Visitors can only mute their own theme music.">
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-signal">{notice}</p>}
    {!settings ? <Btn busy={busy} onClick={() => void load()}>Reload audio settings</Btn> : <>
      <fieldset disabled={busy} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {(['music', 'dialogue', 'effects'] as const).map(channel => <Field key={channel} htmlFor={'audio-'+channel}
            label={(channel === 'music' ? 'Theme music' : channel === 'dialogue' ? 'Dialogue / quotes' : 'Sharingan effects')+' · '+Math.round(settings[channel]*100)+'%'}>
            <input id={'audio-'+channel} aria-label={channel+' volume'} type="range" min="0" max="100" step="1"
              value={Math.round(settings[channel]*100)} onChange={e => setSettings({ ...settings, [channel]: Number(e.target.value)/100 })}
              className="h-8 w-full accent-[#e3140f]" />
          </Field>)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Gap after each dialogue (seconds)" htmlFor="audio-gap" hint="Measured from the end of a recording, regardless of its length.">
            <TextInput id="audio-gap" type="number" min="1" max="600" step="1" value={settings.intervalSeconds}
              onChange={e => setSettings({ ...settings, intervalSeconds: Number(e.target.value) })} />
          </Field>
          <Field label="Theme fade-in (seconds)" htmlFor="audio-fade" hint="Starts silent and rises to the theme volume, then stays there.">
            <TextInput id="audio-fade" type="number" min="0" max="30" step="0.5" value={settings.fadeSeconds}
              onChange={e => setSettings({ ...settings, fadeSeconds: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex items-center gap-3"><Toggle label="Automatic character dialogue" checked={settings.randomDialogue}
          onChange={randomDialogue => setSettings({ ...settings, randomDialogue })} /><span className="text-sm">Automatic character dialogue</span></div>
        <div className="space-y-3">
          <h3 className="font-display text-lg text-bone">Dialogue playlist</h3>
          <p className="text-xs text-muted-foreground">Enable individual recordings and preview every clip here. Preview playback does not change the saved playlist.</p>
          {DIALOGUES.map(quote => <div key={quote.id} className="space-y-3 border border-signal/20 p-4">
            <label className="flex items-start gap-3 text-sm text-bone">
              <input type="checkbox" checked={settings.enabledDialogueIds.includes(quote.id)} className="mt-1 accent-[#e3140f]"
                onChange={e => setSettings({ ...settings, enabledDialogueIds: e.target.checked
                  ? [...settings.enabledDialogueIds, quote.id] : settings.enabledDialogueIds.filter(id => id !== quote.id) })} />
              <span>{quote.character} · {quote.text}</span>
            </label>
            <audio controls preload="none" src={quote.src} aria-label={'Preview '+quote.id}
              className="h-10 w-full" onPlay={e => {
                const active = e.currentTarget;
                document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(media => { if (media !== active) media.pause(); });
              }} />
          </div>)}
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn onClick={() => void save()}>Save audio settings</Btn>
          <Btn variant="outline" onClick={() => { setSettings({ ...DEFAULT_AUDIO_SETTINGS, enabledDialogueIds: [...DEFAULT_AUDIO_SETTINGS.enabledDialogueIds] }); setNotice('Defaults restored in this form. Save to apply.'); }}>Restore defaults</Btn>
        </div>
      </fieldset>
      <p className="mt-5 text-xs text-muted-foreground">Theme loops throughout browsing beneath the voices. Browsers may require the first tap or keypress before audio starts. Muting the public theme button leaves dialogue and effects active.</p>
    </>}
  </Panel>;
}
