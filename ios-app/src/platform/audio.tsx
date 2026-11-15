import { NativeModule, requireNativeModule } from 'expo';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { readDocument, writeDocument } from './storage';
import { finiteNumber, record, text } from './validation';
import { createQuranEngine, type NativeAudioPort, type NativeAudioStatus, type PlayerPreferences, type PlayerSnapshot, type QuranEngine } from './quran/engine';
import { defaultRecitationCode } from './quran/source-rules';
import { quranProvider } from './quran/provider';
import { QuranUsageProvider } from './quran/usage';
import { useAccount } from './account';

type AudioEvents = { onStatus: (status: NativeAudioStatus) => void; onRemote: (event: { action: string; token: number }) => void };
declare class AudioModule extends NativeModule<AudioEvents> implements NativeAudioPort {
  load: NativeAudioPort['load'];
  play: NativeAudioPort['play'];
  pause: NativeAudioPort['pause'];
  stop: NativeAudioPort['stop'];
  seek: NativeAudioPort['seek'];
  volume: NativeAudioPort['volume'];
  sleep: NativeAudioPort['sleep'];
  metadata: NativeAudioPort['metadata'];
  release: NativeAudioPort['release'];
}
const Context = createContext<QuranEngine | null>(null);
const KEY = 'syrian-zone.quran-player.v1';
const initialPreferences: PlayerPreferences = { recitationCode: defaultRecitationCode, volume: 1 };

function decodePreferences(value: unknown): PlayerPreferences {
  const item = record(value);
  return { recitationCode: text(item.recitationCode), volume: Math.max(0, Math.min(1, finiteNumber(item.volume))) };
}
export function AudioProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const account = useAccount(), [preferencesReady, setPreferencesReady] = useState(false);
  const [native] = useState(() => requireNativeModule<AudioModule>('SyrianAudio'));
  const preferenceWrites = useRef(Promise.resolve());
  const [engine] = useState(() => createQuranEngine(native, quranProvider, preferences => {
    const operation = preferenceWrites.current.catch(() => undefined).then(() => writeDocument(KEY, preferences)); preferenceWrites.current = operation; return operation;
  }));
  const lifetime = useRef(0);
  useEffect(() => {
    const generation = ++lifetime.current;
    let active = true;
    const status = native.addListener('onStatus', engine.status);
    const remote = native.addListener('onRemote', event => engine.remote(event.action, event.token));
    void readDocument(KEY, decodePreferences, initialPreferences).then(preferences => { if (active) { engine.initialize(preferences); setPreferencesReady(true); } })
      .catch(() => { if (active) { engine.reportError('تعذر قراءة إعدادات التلاوة المحفوظة.'); setPreferencesReady(true); } });
    return () => {
      active = false; status.remove(); remote.remove();
      // Strict Mode's effect rehearsal immediately remounts this same owner.
      // The latest generation is required here to distinguish a real unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      queueMicrotask(() => { if (lifetime.current === generation) void engine.dispose().catch(() => undefined); });
    };
  }, [engine, native]);
  const accountReciter = account.user?.settings.quranReciterId;
  useEffect(() => { if (preferencesReady && typeof accountReciter === 'string') void engine.setRecitation(accountReciter).catch(() => engine.reportError('تعذر تطبيق قارئ الحساب.')); }, [preferencesReady, accountReciter, account.user?.id, engine]);
  return <Context.Provider value={engine}><QuranUsageProvider engine={engine}>{children}</QuranUsageProvider></Context.Provider>;
}
export type QuranPlayer = PlayerSnapshot & Pick<QuranEngine, 'setRecitation' | 'playContinuous' | 'playReader' | 'toggle' | 'next' | 'prev' | 'stop' | 'setVolume' | 'setMuted' | 'setSleepUntil'>;
export function useQuranPlayer(): QuranPlayer {
  const engine = useContext(Context);
  if (!engine) throw new Error('Native audio provider is unavailable');
  const state = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
  return { ...state, setRecitation: engine.setRecitation, playContinuous: engine.playContinuous, playReader: engine.playReader, toggle: engine.toggle,
    next: engine.next, prev: engine.prev, stop: engine.stop, setVolume: engine.setVolume, setMuted: engine.setMuted, setSleepUntil: engine.setSleepUntil };
}
