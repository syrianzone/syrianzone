// Verification entry only. Production index.ts and App.tsx never import this file.
import { NativeModule, registerRootComponent, requireNativeModule, requireNativeView } from 'expo';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Button,
  ScrollView,
  Text,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { imagePixelSize } from './image-header';
interface NativeAudioStatus { token: number; seconds: number; duration: number; listenedSeconds: number; playing: boolean; loading: boolean; loaded: boolean; ended: boolean; error: string | null; sleepUntil: number | null }
interface NativeAudioPort {
  load(url: string, seconds: number, token: number): Promise<void>;
  play(): Promise<void>; pause(): Promise<void>; stop(): Promise<void>;
  seek(seconds: number, token: number): Promise<void>;
  volume(value: number, muted: boolean): Promise<void>;
  sleep(until: number | null): Promise<void>;
  metadata(title: string, artist: string): Promise<void>;
  release(): Promise<void>;
}
import { zipEntryPaths } from './zip-directory';
import { NativePicker, NativeSlider, NativeToggle } from '../src/ui/native';
import { ArabicInputFixture } from './arabic-input-fixture';


import { SearchFieldFixture } from './search-field-fixture';
import { IconActionHitFixture } from './icon-action-hit-fixture';



type AudioEvents = {
  onStatus: (status: NativeAudioStatus) => void;
  onRemote: (event: { action: string; token: number }) => void;
};
declare class AudioBridge extends NativeModule<AudioEvents> implements NativeAudioPort {
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
interface FilesBridge {
  zip(path: string): Promise<string>;
  imageDataUri(path: string): Promise<string>;
  preview(path: string, title: string): Promise<void>;
  encodeImage(path: string, width: number, height: number, format: string, quality: number): Promise<string>;
}
interface Prepared {
  staging: Directory;
  png: File;
  archive: File;
  encoded: string;
}
interface KeysProps extends ViewProps {
  active: boolean;
  commands: readonly string[];
  onKeyCommand(event: NativeSyntheticEvent<{ key: string }>): void;
}
const BareKeys = requireNativeView<KeysProps>('SyrianZoneLayout', 'Keys');
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPocDnzHwAFiAKY//tLRQAAAABJRU5ErkJggg==';
const TRACK = 'https://everyayah.com/data/Alafasy_128kbps/002255.mp3';
const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
function requireCheck(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function Status({ id, value }: { id: string; value: string }): React.JSX.Element {
  return (
    <Text testID={`adapter.status.${id}`} style={{ color: '#111111', marginVertical: 4 }}>
      {value}
    </Text>
  );
}

export function AdapterFixture(): React.JSX.Element {
  const [toggleValue, setToggleValue] = useState(false), [toggleChanges, setToggleChanges] = useState(0);
  const [toggleEvents, setToggleEvents] = useState<string[]>([]);
  const [pickerValue, setPickerValue] = useState<'first' | 'second'>('first'), [pickerChanges, setPickerChanges] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  
  
  const [native] = useState(() => requireNativeModule<AudioBridge>('SyrianAudio'));
  const [files] = useState(() => requireNativeModule<FilesBridge>('SyrianFiles'));
  const [tab, setTab] = useState('files'),
    [foreground, setForeground] = useState(
      AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    ),
    [busy, setBusy] = useState(false),
    [prepared, setPrepared] = useState<Prepared | null>(null);
  const [results, setResults] = useState<Record<string, string>>({
    files: 'FILES PENDING',
    preview: 'PREVIEW PENDING',
    png: 'PNG SHARE PENDING',
    zip: 'ZIP SHARE PENDING',
    audio: 'AUDIO PENDING',
    pause: 'PAUSE PENDING',
    resume: 'RESUME PENDING',
    owner: 'OWNER PENDING',
    background: 'BACKGROUND PENDING',
    sleep: 'SLEEP PENDING',
    release: 'RELEASE PENDING',
    remote: 'REMOTE NOT TESTED',
    svg: 'SVG PENDING',
    jpeg: 'JPEG PENDING',
    svgShare: 'SVG SHARE PENDING',
    keys: 'KEY PENDING',
    encode: 'ENCODE PENDING',
    localFiles: 'LOCAL FILES PENDING',
  });
  const [status, setStatus] = useState<NativeAudioStatus | null>(null),
    latest = useRef<NativeAudioStatus | null>(null),
    ownedFiles = useRef<Prepared | null>(null),
    lock = useRef(false),
    cancelled = useRef(false),
    backgroundStart = useRef<number | null>(null),
    backgroundArmed = useRef(false);
  const svg = useRef<Svg>(null);
  
  function result(id: string, value: string): void {
    if (!cancelled.current) setResults((current) => ({ ...current, [id]: value }));
  }
  async function until(
    predicate: (value: NativeAudioStatus) => boolean,
    timeout = 20_000,
  ): Promise<NativeAudioStatus> {
    const deadline = Date.now() + timeout;
    while (!cancelled.current && Date.now() < deadline) {
      const value = latest.current;
      if (value?.error) throw new Error(value.error);
      if (value && predicate(value)) return value;
      await delay(50);
    }
    throw new Error('Native status deadline exceeded');
  }
  useEffect(() => {
    cancelled.current = false;
    const statusSubscription = native.addListener('onStatus', (value) => {
      latest.current = value;
      setStatus(value);
    });
    const remoteSubscription = native.addListener('onRemote', (event) =>
      result('remote', `REMOTE ${event.action} token=${event.token}`),
    );
    const lifecycle = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state === 'background' && backgroundArmed.current)
        backgroundStart.current = latest.current?.seconds ?? null;
      if (state === 'active' && backgroundArmed.current && backgroundStart.current !== null) {
        const baseline = backgroundStart.current;
        backgroundArmed.current = false;
        backgroundStart.current = null;
        void until((value) => value.playing && value.seconds >= baseline + 1, 10_000)
          .then(() => result('background', 'BACKGROUND PASS actual native media advanced'))
          .catch((error) => result('background', `BACKGROUND FAIL ${String(error)}`));
      }
    });
    return () => {
      cancelled.current = true;
      statusSubscription.remove();
      remoteSubscription.remove();
      lifecycle.remove();
      void native.release();
      const current = ownedFiles.current;
      if (current?.archive.exists) current.archive.delete();
      if (current?.staging.exists) current.staging.delete();
    };
    // The verification owner is fixed for this entry's lifetime.
  }, [native]);
  async function run(id: string, operation: () => Promise<void>): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    result(id, `${id.toUpperCase()} RUNNING`);
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.message}${error.cause ? ` CAUSE ${String(error.cause)}` : ''}`
          : String(error);
      result(id, `${id.toUpperCase()} FAIL ${message}`);
    } finally {
      lock.current = false;
      if (!cancelled.current) setBusy(false);
    }
  }
  function prepare(): void {
    void run('files', async () => {
      const old = ownedFiles.current;
      if (old?.archive.exists) old.archive.delete();
      if (old?.staging.exists) old.staging.delete();
      const staging = new Directory(Paths.cache, `sz-zip-verification-${randomUUID()}`),
        directory = new Directory(staging, 'backup'),
        images = new Directory(directory, 'images'),
        nested = new Directory(directory, 'مسار');
      images.create({ intermediates: true });
      nested.create({ intermediates: true });
      const png = new File(images, 'one.png');
      png.create();
      await png.write(PNG, { encoding: 'base64' });
      const text = new File(nested, 'نص.txt');
      text.create();
      await text.write('Native ZIP verification only. No account data.');
      const encoded = await files.imageDataUri(png.uri);
      requireCheck(encoded.startsWith('data:image/png;base64,'), 'PNG native conversion failed');
      const archive = new File(await files.zip(directory.uri));
      requireCheck(archive.size > 0 && archive.size < 1_000_000, 'ZIP size outside bounded fixture');
      const paths = zipEntryPaths(await archive.bytes());
      requireCheck(
        paths.some((path) => path.endsWith('images/one.png')),
        'PNG nested ZIP entry missing',
      );
      requireCheck(
        paths.some((path) => path.endsWith('مسار/نص.txt')),
        'Unicode nested ZIP entry missing',
      );
      const current = { staging, png, archive, encoded };
      ownedFiles.current = current;
      setPrepared(current);
      result('files', `FILES PASS native PNG and nested Unicode ZIP (${archive.size} bytes)`);
    });
  }
  function preview(): void {
    if (!prepared) return;
    void run('preview', async () => {
      result('preview', 'PREVIEW PRESENTING');
      await files.preview(prepared.png.uri, 'Native one-pixel PNG fixture');
      result('preview', 'PREVIEW PASS native QuickLook dismissed');
    });
  }
  function directEncode(): void {
    void run('encode', async () => {
      requireCheck(typeof files.encodeImage === 'function', 'Native encodeImage method unavailable');
      const source = new File(Paths.cache, `sz-encoder-direct-${randomUUID()}.png`);
      try {
        source.create();
        await source.write(PNG, { encoding: 'base64' });
        for (const format of ['png', 'jpg'] as const) {
          const image = new File(await files.encodeImage(source.uri, 80, 40, format, 0.9));
          try {
            const size = imagePixelSize(await image.bytes(), format);
            requireCheck(size.width === 80 && size.height === 40, `Bare${format} dimensions mismatch`);
          } finally {
            if (image.exists) image.delete();
          }
        }
        result('encode', 'ENCODE PASS bare native PNG and JPEG80x40');
      } finally {
        if (source.exists) source.delete();
      }
    });
  }
  
  
  
  
  
  function zipShare(): void {
    if (!prepared) return;
    void run('zip', async () => {
      result('zip', 'ZIP SHARE PRESENTING');
      requireCheck(await Sharing.isAvailableAsync(), 'Sharing unavailable');
      await Sharing.shareAsync(prepared.archive.uri, {
        mimeType: 'application/zip',
        dialogTitle: 'native-verification.zip',
      });
      result('zip', 'ZIP SHARE PASS native share completed or cancelled');
    });
  }
  function audioStart(): void {
    void run('audio', async () => {
      await native.volume(0.15, false);
      await native.metadata('Native adapter verification', 'Public Quran recording, no usage API');
      await native.load(TRACK, 0, 101);
      await until((value) => value.token === 101 && value.playing && value.seconds >= 0.5);
      result('audio', 'AUDIO PASS token=101 playing');
    });
  }
  function audioPause(): void {
    void run('pause', async () => {
      await native.pause();
      const before = await until((value) => !value.playing);
      await delay(900);
      const after = latest.current;
      requireCheck(
        after &&
          !after.playing &&
          after.seconds - before.seconds < 0.15 &&
          after.listenedSeconds - before.listenedSeconds < 0.15,
        'Paused media/listening advanced',
      );
      result('pause', 'PAUSE PASS media and native listening stayed paused');
    });
  }
  function audioResume(): void {
    void run('resume', async () => {
      await native.play();
      await until((value) => value.playing);
      result('resume', 'RESUME PASS native player resumed');
    });
  }
  function audioOwner(): void {
    void run('owner', async () => {
      await native.load(TRACK, 1, 202);
      await until((value) => value.token === 202 && value.playing && value.seconds >= 1.25);
      result('owner', 'OWNER PASS token=202 replaced old item');
    });
  }
  function armBackground(): void {
    void run('background', async () => {
      await native.play();
      await until((value) => value.playing);
      backgroundArmed.current = true;
      result('background', 'BACKGROUND ARMED press Home, wait 3 seconds, activate');
    });
  }
  function audioSleep(): void {
    void run('sleep', async () => {
      await native.play();
      await until((value) => value.playing);
      const deadline = Date.now() + 3000;
      await native.sleep(deadline);
      result('sleep', 'SLEEP ARMED native deadline 3 seconds');
      await until((value) => value.sleepUntil === null && !value.playing && value.loaded, 10_000);
      requireCheck(Date.now() >= deadline - 100, 'Native sleep paused before deadline');
      result('sleep', 'SLEEP PASS native deadline paused audio');
    });
  }
  function release(): void {
    void run('release', async () => {
      await native.stop();
      await until((value) => !value.loaded && !value.playing);
      await native.release();
      result('release', 'RELEASE PASS owner stopped and released');
    });
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ paddingTop: 60, paddingBottom: 50, paddingHorizontal: 20, gap: 8 }}
    >
      <Text testID="adapter.fixture" style={{ fontSize: 22, color: '#111111' }}>
        Native adapter verification
      </Text>
      <Text style={{ color: '#111111' }}>
        Isolated fixture. No account, production API or usage reporting.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 8 }}>
        <Button testID="adapter.tab.files" title="Files" onPress={() => setTab('files')} />
        <Button testID="adapter.tab.audio" title="Audio" onPress={() => setTab('audio')} />
        <Button testID="adapter.tab.inputs" title="Inputs" onPress={() => setTab('inputs')} />
        
        
        <Button testID="adapter.tab.search" title="Find" onPress={() => setTab('search')} />
        <Button testID="adapter.tab.icon-hit" title="Icons" onPress={() => setTab('icon-hit')} />
      </View>
      {tab === 'icon-hit' ? <IconActionHitFixture /> : tab === 'search' ? <SearchFieldFixture /> : tab === 'inputs' ? <ArabicInputFixture /> : tab === 'files' ? (
        <>
          <NativeToggle title="تحقق المفتاح الأصلي" value={toggleValue} onChange={value => {
            setToggleEvents(events => [...events, `${typeof value}:${String(value)}`].slice(-4));
            if (typeof value === 'boolean') setToggleValue(value);
            setToggleChanges(count => count + 1);
          }} />
          <Status id="toggle" value={`TOGGLE ${toggleValue ? 'ON' : 'OFF'} ${toggleChanges}`} />
          <Status id="toggle-events" value={`TOGGLE EVENTS ${toggleEvents.join(',')}`} />
          <NativePicker label="قائمة التحقق الأصلية" value={pickerValue} options={[{ label: 'الخيار الأول', value: 'first' }, { label: 'الخيار الثاني', value: 'second' }]} onChange={value => {
            setPickerValue(value); setPickerChanges(count => count + 1);
          }} />
          <Status id="picker" value={`PICKER ${pickerValue} ${pickerChanges}`} />
          <NativeSlider label="شريط التحقق الأصلي" value={sliderValue} onChange={setSliderValue} min={0} max={100} step={1} />
          <Status id="slider" value={`SLIDER ${sliderValue}`} />
          <View testID="adapter.picker.long-slot">
            <NativePicker label="مصدر التحقق الأصلي الطويل" value="source" options={[{ value: 'source', label: 'مصدر بيانات طويل للتحقق من احتواء القائمة الأصلية داخل المساحة المخصصة لها مع بقاء اسم المصدر الكامل متاحاً لقارئ الشاشة' }]} onChange={() => {}} />
          </View>
          <BareKeys
            active={foreground}
            commands={['1', 'ArrowLeft']}
            accessible={false}
            pointerEvents="none"
            style={{ position: 'absolute', width: 1, height: 1, top: 0, start: 0 }}
            onKeyCommand={(event) => result('keys', `KEY ${event.nativeEvent.key}`)}
          />
          <Status id="keys" value={results.keys ?? ''} />
          <Button
            testID="adapter.encode"
            title="Bare native PNG/JPEG encoder"
            disabled={busy}
            onPress={directEncode}
          />
          <Status id="encode" value={results.encode ?? ''} />
          <Svg ref={svg} width={80} height={40} viewBox="0 0 80 40">
            <Rect width={80} height={40} fill="#006B45" />
            <Circle cx={40} cy={20} r={12} fill="#FFFFFF" />
            <Rect x={2} y={2} width={10} height={6} fill="#FF0000" />
            <Rect x={2} y={32} width={10} height={6} fill="#0000FF" />
          </Svg>
          
          
          
          
          
          
          
          
          
          
          
          
          <Button testID="adapter.prepare" title="Prepare bounded files" disabled={busy} onPress={prepare} />
          <Status id="files" value={results.files ?? ''} />
          <Button
            testID="adapter.preview"
            title="Preview PNG in QuickLook"
            disabled={busy || !prepared}
            onPress={preview}
          />
          <Status id="preview" value={results.preview ?? ''} />
          
          
          <Button
            testID="adapter.zip-share"
            title="Share nested ZIP"
            disabled={busy || !prepared}
            onPress={zipShare}
          />
          <Status id="zip" value={results.zip ?? ''} />
        </>
      ) : (
        <>
          <Status
            id="live"
            value={
              status
                ? `token=${status.token} playing=${status.playing} loaded=${status.loaded} seconds=${status.seconds.toFixed(2)} listened=${status.listenedSeconds.toFixed(2)} error=${status.error ?? 'none'}`
                : 'No native audio status'
            }
          />
          <Button
            testID="adapter.audio-start"
            title="Start public track"
            disabled={busy}
            onPress={audioStart}
          />
          <Status id="audio" value={results.audio ?? ''} />
          <Button
            testID="adapter.audio-pause"
            title="Pause and check clock"
            disabled={busy}
            onPress={audioPause}
          />
          <Status id="pause" value={results.pause ?? ''} />
          <Button testID="adapter.audio-resume" title="Resume" disabled={busy} onPress={audioResume} />
          <Status id="resume" value={results.resume ?? ''} />
          <Button
            testID="adapter.audio-owner"
            title="Replace owner token"
            disabled={busy}
            onPress={audioOwner}
          />
          <Status id="owner" value={results.owner ?? ''} />
          <Button
            testID="adapter.audio-background"
            title="Arm actual background check"
            disabled={busy}
            onPress={armBackground}
          />
          <Status id="background" value={results.background ?? ''} />
          <Button
            testID="adapter.audio-sleep"
            title="Arm native sleep 3 seconds"
            disabled={busy}
            onPress={audioSleep}
          />
          <Status id="sleep" value={results.sleep ?? ''} />
          <Button testID="adapter.audio-release" title="Stop and release" disabled={busy} onPress={release} />
          <Status id="release" value={results.release ?? ''} />
          <Status id="remote" value={results.remote ?? ''} />
        </>
      )}
    </ScrollView>
  );
}

registerRootComponent(AdapterFixture);
