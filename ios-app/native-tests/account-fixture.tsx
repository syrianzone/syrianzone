import { openDatabaseAsync } from 'expo-sqlite';
import { createPrayerLocalStore } from './prayer-sync/prayer-local-store';
// Separate verification entry. No production entry or route imports this file.
import { registerRootComponent } from 'expo';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { parsePrayerFixtureLaunch } from './prayer-sync/prayer-launch-model';
import { createPrayerLocalJournal, prayerJournalKey } from './prayer-sync/prayer-local-journal';
import { preparePrayerSession } from './prayer-sync/prayer-session-fixture';
import { restorePrayerFixture } from './prayer-sync/prayer-restore-fixture';
import { createPrayerTimesFixture, prayerTimesFixtureLabel } from './prayer-sync/prayer-times-fixture';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as ReactNative from 'react-native';
import { inputTraceCommand, type InputTraceController, type InputTraceReply } from './account-input-trace';
import { prepareInputTrace } from './account-input-trace-session';
import { getPersonalStorage, getPersistenceScope } from '../src/platform/persistence';
import { configuredSiteOrigin } from '../src/platform/site-origin';
import { assertFixtureScope, decodeFixtureSession, fixtureFetch, fixtureNavigationSubmission, fixtureOrigin, fixtureUsers, parseFixtureLaunch, type FixtureUploadDiagnostic } from './account-fixture-model';
import { clearFixturePersonalStorage } from './studio-cleanup';
import { prepareStudioPending } from './studio-fixture-model';
import { QuranAudioObserver } from './quran-audio-observer';

import { parseAlignmentFixtureLaunch } from './alignment/alignment-launch-model';
import { createAlignmentFixture } from './alignment/alignment-fixture-model';
import { createAlignmentLocalStore } from './alignment/alignment-local-store';
import { prepareAlignmentSession } from './alignment/alignment-session-fixture';

interface Ready { Component: ComponentType; user: string; id: number; variant?: 'popup-long' | 'transit-studio' | 'prayer-sync' | 'alignment'; run?: string }
const publicQuranReads = process.env.EXPO_PUBLIC_NATIVE_QURAN_READS === '1';
const preserveStudioPending = process.env.EXPO_PUBLIC_NATIVE_PRESERVE_STUDIO_PENDING === '1';
const preservePrayerState = process.env.EXPO_PUBLIC_NATIVE_PRESERVE_PRAYER_STATE === '1';
const preserveAlignmentDocument = process.env.EXPO_PUBLIC_NATIVE_PRESERVE_ALIGNMENT_DOCUMENT === '1';
const uploadDiagnostics = process.env.EXPO_PUBLIC_NATIVE_UPLOAD_DIAGNOSTICS === '1';
const inputTraceEnabled = process.env.EXPO_PUBLIC_NATIVE_INPUT_TRACE === '1';

async function openPrayerLocalJournal(scope: Awaited<ReturnType<typeof getPersistenceScope>>) {
  const existing = await getPersonalStorage();
  await existing.getItemAsync(prayerJournalKey);
  const database = await openDatabaseAsync(scope.databaseName);
  return createPrayerLocalJournal(createPrayerLocalStore(scope, database), fixtureOrigin,
    value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
}

async function withAlignmentFixture<T>(task: (fixture: ReturnType<typeof createAlignmentFixture>) => Promise<T>): Promise<T> {
  const scope = await getPersistenceScope(); assertFixtureScope(scope);
  await (await getPersonalStorage()).getItemAsync('syrian-zone.native-fixture.alignment-owner.v1');
  const database = await openDatabaseAsync(scope.databaseName);
  try { return await task(createAlignmentFixture(createAlignmentLocalStore(scope, database))); }
  finally { await database.closeAsync(); }
}

function AccountFixture(): React.JSX.Element {
  const [ready, setReady] = useState<Ready | null>(null);
  const [status, setStatus] = useState('LOCAL FIXTURE WAITING');
  const [destination, setDestination] = useState('');
  const [navigationError, setNavigationError] = useState(false);
  const [navigationAck, setNavigationAck] = useState<{ sequence: number; destination: string; status: 'idle' | 'opening' | 'opened' | 'failed' }>({ sequence: 0, destination: '', status: 'idle' });
  const navigationSequence = useRef(0);
  const inputTrace = useRef<InputTraceController | null>(null);
  const inputTraceSequence = useRef(0);
  const [inputTraceReply, setInputTraceReply] = useState<(InputTraceReply & { requestSequence: number }) | null>(null);
  const [quranReads, setQuranReads] = useState<Record<string, number>>({});
  const [prayerLocal, setPrayerLocal] = useState<Record<string, unknown> | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Record<string, unknown> | null>(null);
  const [alignmentProof, setAlignmentProof] = useState<Record<string, unknown> | null>(null);
  const [studioPreflight, setStudioPreflight] = useState<{ pending: 'absent' } | null>(null);
  const [popupOverrides, setPopupOverrides] = useState(0);
  const [uploadObservations, setUploadObservations] = useState<FixtureUploadDiagnostic[]>([]);
  const started = useRef(false);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const prepare = async (url: string | null): Promise<void> => {
      if (!url || started.current) return;
      // Ignore normal product navigation after fixture setup. Cleanup is cold-start only.
      if (!url.startsWith('syrianzone://fixture/')) return;
      started.current = true;
      try {
        const launch = parseAlignmentFixtureLaunch(configuredSiteOrigin, url) ?? parsePrayerFixtureLaunch(configuredSiteOrigin, url) ?? parseFixtureLaunch(configuredSiteOrigin, url);
        const scope = await getPersistenceScope();
        assertFixtureScope(scope);
        if ([preserveStudioPending, preservePrayerState, preserveAlignmentDocument].filter(Boolean).length > 1 || preserveAlignmentDocument && inputTraceEnabled) throw new Error('Mixed fixture preservation modes rejected.');
        if (launch.kind === 'cleanup') {
          for (const key of [scope.tokenKey, scope.deviceKey, scope.guestIdentityKey]) await SecureStore.deleteItemAsync(key);
          const local = await getPersonalStorage();
          await clearFixturePersonalStorage(scope, local, preserveStudioPending, preservePrayerState, preserveAlignmentDocument);
          if (alive) setStatus('FIXTURE CLEANED, ORIGINAL DATA UNTOUCHED');
          return;
        }
        if (launch.kind === 'prayer-restore') {
          if (!preservePrayerState || preserveStudioPending) throw new Error('Prayer-only cleanup mode required.');
          const local = await openPrayerLocalJournal(scope);
          const restored = await restorePrayerFixture(launch, local, fixtureFetch(globalThis.fetch.bind(globalThis)));
          if (alive) { setPrayerLocal(restored); setStatus('LOCAL PRAYER RESTORED'); }
          return;
        }
        if (preserveAlignmentDocument !== (launch.variant === 'alignment')) throw new Error('Alignment-only cleanup mode rejected.');
        if (preservePrayerState !== (launch.variant === 'prayer-sync')) throw new Error('Prayer-only cleanup mode rejected.');
        if (preserveStudioPending !== (launch.variant === 'transit-studio')) throw new Error('Studio-only cleanup mode rejected.');
        const transport = globalThis.fetch.bind(globalThis);
        const transportOptions = { publicQuranReads, onPublicQuranRead: (providerUrl: string, responseStatus: number) => {
          const path = new URL(providerUrl).pathname;
          if (alive) setQuranReads(previous => Object.fromEntries([...Object.entries(previous).filter(([key]) => key !== path), [path, responseStatus]].slice(-30)));
        }, ...(uploadDiagnostics ? { onUploadDiagnostic: (value: FixtureUploadDiagnostic) => {
          if (alive) setUploadObservations(previous => [...previous, value].slice(-6));
        } } : {}) };
        globalThis.fetch = fixtureFetch(transport, transportOptions);
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const response = await fetch(`${fixtureOrigin}/__native_fixture/session?user=${launch.user}`, {
            headers: { 'X-Native-Fixture-Key': launch.gate, Accept: 'application/json' }, signal: controller.signal,
          });
          if (!response.ok) throw new Error('session');
          const session = decodeFixtureSession(await response.json());
          const verification = await fetch(`${fixtureOrigin}/api/v1/user`, {
            headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json', 'User-Agent': 'SyrianZone-iOS/0.1' }, signal: controller.signal,
          });
          if (!verification.ok) throw new Error('identity');
          const user: unknown = await verification.json();
          const id = user && typeof user === 'object' && 'id' in user ? user.id : null;
          if (launch.variant === 'alignment') {
            const proof = await prepareAlignmentSession<Record<string, unknown>>(launch, id, session.token, globalThis.fetch, () => withAlignmentFixture<Record<string, unknown>>(fixture =>
              launch.stage === 'close' ? fixture.close(launch.run) : fixture.prepare(launch.run, launch.stage)));
            if (alive) setAlignmentProof(proof);
            if (launch.stage === 'close') { if (alive) setStatus('LOCAL ALIGNMENT CLOSED'); return; }
          }
          if (typeof id !== 'number' || id !== fixtureUsers[launch.user]) throw new Error('identity');
          if (launch.variant === 'popup-long') {
            if (launch.user !== 'member' || id !== 101) throw new Error('identity');
            globalThis.fetch = fixtureFetch(transport, { ...transportOptions, popupVariant: 'popup-long',
              onPopupOverride: () => { if (alive) setPopupOverrides(previous => previous + 1); } });
          }
          if (launch.variant === 'transit-studio') {
            if (launch.user !== 'member' || id !== 101) throw new Error('identity');
            const proof = await prepareStudioPending(await getPersonalStorage(), session.token, globalThis.fetch);
            if (alive) setStudioPreflight(proof);
          }
          if (launch.variant === 'prayer-sync') {
            if ((launch.user !== 'member' || id !== 101) && (launch.user !== 'other' || id !== 102)) throw new Error('identity');
            const preflight = await preparePrayerSession(() => openPrayerLocalJournal(scope), launch, session.token, globalThis.fetch, user);
            if (alive) setPrayerLocal(preflight);
            globalThis.fetch = fixtureFetch(createPrayerTimesFixture(transport, metadata => {
              if (alive) setPrayerTimes(previous => ({ nonce: launch.run, day: launch.day, ...metadata, reads: Number(previous?.reads ?? 0) + 1 }));
            }), transportOptions);
          }
          if (inputTraceEnabled) {
            const namespace: unknown = Reflect.get(ReactNative, 'default') ?? ReactNative;
            inputTrace.current = await prepareInputTrace(namespace, { origin: configuredSiteOrigin, user: launch.user, id }, session.token, globalThis.fetch);
          }
          await SecureStore.setItemAsync(scope.tokenKey, session.token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
          // App imports capture the guarded transport only after local credentials are verified.
          const { default: Component } = await import('../src/App');
          if (alive) { setReady({ Component, user: launch.user, id, ...(launch.variant ? { variant: launch.variant } : {}), ...(launch.variant === 'alignment' ? { run: launch.run } : {}) }); setStatus('LOCAL FIXTURE VERIFIED'); }
        } finally { clearTimeout(timeout); }
      } catch {
        if (alive) setStatus('LOCAL FIXTURE SETUP FAILED');
      }
    };
    const subscription = Linking.addEventListener('url', event => { void prepare(event.url); });
    void Linking.getInitialURL().then(prepare).catch(() => { if (alive) setStatus('LOCAL FIXTURE SETUP FAILED'); });
    return () => { alive = false; controller.abort(); subscription.remove(); inputTrace.current?.dispose(); };
  }, []);
  const Component = ready?.Component;
  const readInputTrace = () => {
    try {
      if (!inputTraceEnabled || !ready || !inputTrace.current || !inputTraceReply || inputTraceSequence.current >= Number.MAX_SAFE_INTEGER)
        throw new Error('Input trace read is unavailable.');
      const reply = inputTraceCommand(inputTrace.current, `inputtrace.read.${inputTraceReply.nonce}`);
      setInputTraceReply({ ...reply, requestSequence: ++inputTraceSequence.current });
      setNavigationError(false);
    } catch { setNavigationError(true); }
  };
  const openDestination = (text: string) => {
    if (!ready) { setNavigationError(true); return; }
    if (text.startsWith('inputtrace.')) {
      try {
        if (!inputTraceEnabled || !inputTrace.current || !text.startsWith('inputtrace.arm.')) throw new Error('Input trace arming is unavailable.');
        if (inputTraceSequence.current >= Number.MAX_SAFE_INTEGER) throw new Error('Input trace sequence rejected.');
        const reply = inputTraceCommand(inputTrace.current, text);
        setInputTraceReply({ ...reply, requestSequence: ++inputTraceSequence.current });
        setNavigationError(false); setDestination('');
      } catch { setNavigationError(true); }
      return;
    }
    let submitted: ReturnType<typeof fixtureNavigationSubmission>;
    try { submitted = fixtureNavigationSubmission(text, navigationSequence.current + 1); }
    catch { setNavigationError(true); return; }
    navigationSequence.current = submitted.sequence;
    const acknowledgement = { sequence: submitted.sequence, destination: submitted.destination };
    setNavigationAck({ ...acknowledgement, status: 'opening' });
    setNavigationError(false);
    if (ready.variant === 'alignment' && ready.run && ['alignment_observe', 'alignment_checkpoint', 'alignment_empty_saved'].includes(submitted.destination)) {
      const run = ready.run;
      void withAlignmentFixture<Record<string, unknown>>(fixture => submitted.destination === 'alignment_checkpoint' ? fixture.checkpoint(run)
        : submitted.destination === 'alignment_empty_saved' ? fixture.acknowledgeEmptySaved(run) : fixture.observe(run)).then(proof => {
        if (navigationSequence.current === submitted.sequence) { setAlignmentProof(proof); setNavigationAck({ ...acknowledgement, status: 'opened' }); }
      }).catch(() => {
        if (navigationSequence.current === submitted.sequence) { setNavigationError(true); setNavigationAck({ ...acknowledgement, status: 'failed' }); }
      });
      setDestination(''); return;
    }
    // XCTest's app.open relaunches the process. This fixture-only field sends
    // the real native URL event while keeping the verified session in memory.
    void Linking.openURL(submitted.url).then(() => {
      if (navigationSequence.current === submitted.sequence) setNavigationAck({ ...acknowledgement, status: 'opened' });
    }).catch(() => {
      if (navigationSequence.current === submitted.sequence) {
        setNavigationError(true); setNavigationAck({ ...acknowledgement, status: 'failed' });
      }
    });
    setDestination('');
  };
  return <View style={{ flex: 1, paddingTop: 62, backgroundColor: '#FFFFFF' }}>
    <View style={{ paddingHorizontal: 8, paddingBottom: 6, backgroundColor: '#FFF3C4' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text testID="account.fixture.origin" style={{ color: '#111111', fontSize: 12 }}>{fixtureOrigin}</Text>
        <TextInput testID="account.fixture.destination" accessibilityLabel="Fixture section" placeholder="Section" value={destination} onChangeText={setDestination}
          onSubmitEditing={event => openDestination(event.nativeEvent.text)} returnKeyType="go" submitBehavior="blurAndSubmit" autoCapitalize="none" autoCorrect={false}
          style={{ flex: 1, minHeight: 44, color: '#111111', backgroundColor: '#FFFFFF', fontSize: 12 }} />
        {inputTraceEnabled ? <Pressable testID="account.fixture.input-trace.read" accessible accessibilityRole="button" accessibilityLabel="Capture own input trace"
          disabled={!ready || !inputTraceReply} accessibilityState={{ disabled: !ready || !inputTraceReply }} onPress={readInputTrace}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#111111', fontSize: 12 }}>Read</Text></Pressable> : null}
      </View>
      <Text testID="account.fixture.status" accessibilityValue={{ text: JSON.stringify({ ...navigationAck, ...(alignmentProof ? { alignment: alignmentProof } : {}), ...(inputTraceEnabled ? { inputTrace: inputTraceReply } : {}), ...(ready?.variant === 'transit-studio' ? { studioPreflight } : {}), ...(uploadDiagnostics ? { uploads: uploadObservations } : {}) }) }} style={{ color: '#111111', fontSize: 12 }}>{status}</Text>
      {navigationError ? <Text testID="account.fixture.navigation-error" style={{ color: '#111111' }}>LOCAL NAVIGATION FAILED</Text> : null}
      {ready ? <Text testID="account.fixture.identity" style={{ color: '#111111', fontSize: 12 }}>{`LOCAL ${ready.user} ${ready.id}`}</Text> : null}
      {ready?.variant === 'popup-long' ? <Text testID="account.fixture.popup-layout" style={{ color: '#111111', fontSize: 12 }}>{`LOCAL POPUP LONG HOME OVERRIDES ${popupOverrides}`}</Text> : null}
      {prayerLocal ? <Text testID="account.fixture.prayer.local" accessibilityValue={{ text: JSON.stringify(prayerLocal) }} style={{ color: '#111111', fontSize: 12 }}>LOCAL PRAYER STATE</Text> : null}
      {ready?.variant === 'prayer-sync' ? <Text testID="account.fixture.prayer.times" accessibilityValue={{ text: JSON.stringify(prayerTimes) }} style={{ color: '#111111', fontSize: 12 }}>{prayerTimesFixtureLabel}</Text> : null}
      {ready && publicQuranReads ? <QuranAudioObserver reads={quranReads} /> : null}
    </View>
    {Component ? <Component /> : null}
  </View>;
}
registerRootComponent(AccountFixture);
