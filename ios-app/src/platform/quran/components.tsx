import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentStyle, Heading, Label, Row, SearchField, Section } from '../../components';
import { normalizeSearch } from '../../domain';
import { NativeAction, NativeIconAction, NativeSlider } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAccount } from '../account';
import { useQuranPlayer } from '../audio';
import { toArabicDigits } from '../dates';
import { useQuranFont } from './fonts';
import { ayahCounts, recitations, recitationByCode, surahNames } from './source-rules';

export function RecitationPicker(): React.JSX.Element {
  const player = useQuranPlayer(), account = useAccount(), { colors } = useTheme();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const current = recitationByCode(player.recitationCode), matches = recitations.filter(item => normalizeSearch(`${item.nameAr} ${item.nameEn}`).includes(normalizeSearch(query)));
  async function choose(code: string): Promise<void> {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await player.setRecitation(code); setOpen(false); setQuery('');
      if (account.user) await account.saveSettings({ quranReciterId: code });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ القارئ.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}><NativeAction title={`القارئ: ${current.nameAr}`} systemImage="mic" onPress={() => setOpen(true)} />
    {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={contentStyle}><Heading>اختيار القارئ</Heading><NativeAction title="تم" onPress={() => setOpen(false)} /><SearchField value={query} onChange={setQuery} placeholder="ابحث عن قارئ بالعربية أو الإنجليزية" /></View>
      {busy ? <ActivityIndicator accessibilityLabel="جارٍ تغيير القارئ" color={colors.accent} /> : null}
      <FlatList data={matches} keyExtractor={item => item.code} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" renderItem={({ item }) =>
        <Row title={item.nameAr} subtitle={item.nameEn} selected={item.code === player.recitationCode} onPress={() => { void choose(item.code); }} />}
        ListEmptyComponent={<Label secondary>لا نتائج مطابقة</Label>} />
    </SafeAreaView></Modal>
  </View>;
}
export function QuranTransport({ volume = false, onStart, source = 'continuous' }: { volume?: boolean; source?: 'reader' | 'continuous'; onStart?(): void }): React.JSX.Element {
  const player = useQuranPlayer(), { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const owns = player.source === source, playing = owns && player.playing, loading = owns && player.loading;
  function perform(operation: Promise<void>): void { void operation.catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر التحكم بالتلاوة.')); }
  return <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
    <NativeIconAction title="الآية السابقة" systemImage="backward.end" disabled={!owns || !player.current || (player.current.surah === 1 && player.current.ayah === 1)} onPress={() => perform(player.prev())} />
    <NativeIconAction title={loading ? 'جارٍ التحميل' : playing ? 'إيقاف مؤقت' : 'تشغيل'} systemImage={playing ? 'pause.fill' : 'play.fill'} disabled={loading}
      onPress={() => { if (playing) perform(player.toggle()); else if (onStart) onStart(); else perform(owns && player.current ? player.toggle() : player.playContinuous(player.current ? { start: player.current } : undefined)); }} />
    <NativeIconAction title="الآية التالية" systemImage="forward.end" disabled={!owns || !player.current || (player.current.surah === 114 && player.current.ayah === ayahCounts[114])} onPress={() => perform(player.next())} />
  </View>
    {source === 'reader' ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: owns ? Math.round(player.progress * 100) : 0 }} accessibilityLabel="تقدم تلاوة الآية" style={{ height: 3, backgroundColor: colors.elevated }}><View style={{ height: 3, width: `${owns ? player.progress * 100 : 0}%`, backgroundColor: colors.accent }} /></View> : null}
    {volume ? <><NativeAction title={player.muted ? 'إلغاء الكتم' : 'كتم الصوت'} systemImage={player.muted ? 'speaker.slash' : 'speaker.wave.2'} onPress={() => perform(player.setMuted(!player.muted))} />
      <NativeSlider label="مستوى الصوت" value={player.muted ? 0 : player.volume} min={0} max={1} step={0.05} onChange={value => perform(player.setVolume(value))} /></> : null}
    {error || player.error ? <Label style={{ color: colors.danger }}>{error ?? player.error}</Label> : null}
  </View>;
}
export function QuranNowReading({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const player = useQuranPlayer(), font = useQuranFont(), { colors } = useTheme();
  if (font.error) return <View><Label style={{ color: colors.danger }}>{font.error}</Label><NativeAction title="إعادة المحاولة" onPress={font.retry} /></View>;
  return <View style={{ gap: 8 }}><Label secondary>{player.current ? `${surahNames[player.current.surah]}، آية ${player.current.ayah}` : 'اختر التلاوة للاستماع'}</Label>
    {!font.ready ? <ActivityIndicator accessibilityLabel="جارٍ تحميل الخط" color={colors.accent} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 4 : 7 }}>
      {player.words.map((word, index) => {
        const active = player.activeWord?.position === index + 1 && player.activeWord.ayah === player.current?.ayah;
        const progress = active && player.activeWord?.letterIndex && player.activeWord.letterCount ? player.activeWord.letterIndex / player.activeWord.letterCount : 1;
        return <View key={`${player.current?.surah}:${player.current?.ayah}:${index}`} style={{ position: 'relative', overflow: 'hidden', borderRadius: 5 }}>
          {active ? <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: colors.accentMuted }} /> : null}
          <Text style={{ color: active ? colors.accent : colors.text, fontFamily: 'QuranHafs', fontSize: compact ? 20 : 28, lineHeight: compact ? 37 : 51, writingDirection: 'rtl' }}>{word}</Text>
        </View>;
      })}
      {player.current && !player.words.length ? <Label secondary>نص التلاوة غير متاح حالياً.</Label> : null}
    </View>}
  </View>;
}
export function QuranWordWindow({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const player = useQuranPlayer(), font = useQuranFont(), { colors } = useTheme();
  const [last, setLast] = useState<{ surah: number; ayah: number; position: number } | null>(null);
  const priorCode = useRef(player.recitationCode);
  useEffect(() => {
    if (priorCode.current !== player.recitationCode) { priorCode.current = player.recitationCode; setLast(null); }
    if (player.activeWord) setLast({ surah: player.activeWord.surah, ayah: player.activeWord.ayah, position: player.activeWord.position });
  }, [player.activeWord, player.recitationCode]);
  const flat = useMemo(() => [...player.text.entries()].sort((a, b) => a[0] - b[0]).flatMap(([ayah, words]) => words.map(([position, word]) => ({ ayah, position, word }))), [player.text]);
  const active = player.activeWord ?? (last?.surah === player.current?.surah ? last : null);
  const index = active ? flat.findIndex(word => word.ayah === active.ayah && word.position === active.position) : -1;
  const visible = index >= 0 ? flat.slice(Math.max(0, index - 2), index + 3) : [];
  return <View style={{ gap: 8 }}><Label secondary style={{ textAlign: 'center' }}>{player.current ? surahNames[player.current.surah] : 'تلاوة متابَعة'}</Label>
    {font.error ? <><Label style={{ color: colors.danger }}>{font.error}</Label><NativeAction title="إعادة المحاولة" onPress={font.retry} /></> : null}
    {font.ready && visible.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>{visible.map((word, offset) =>
      <View key={`${word.ayah}:${word.position}`} style={{ flexDirection: 'row', gap: 5 }}><Text style={{ fontFamily: 'QuranHafs', fontSize: compact ? 20 : 29, lineHeight: compact ? 37 : 52,
        writingDirection: 'rtl', color: word.ayah === active?.ayah && word.position === active.position ? colors.accent : colors.text }}>{word.word}</Text>
        {visible[offset + 1] && visible[offset + 1]?.ayah !== word.ayah ? <Text style={{ fontFamily: 'QuranHafs', color: colors.secondary }}>{`﴿${toArabicDigits(word.ayah)}﴾`}</Text> : null}</View>)}</View>
      : <Label secondary style={{ textAlign: 'center' }}>{player.loading ? 'جارٍ تجهيز التلاوة' : player.current ? 'بانتظار موضع التلاوة' : 'اضغط تشغيل لبدء التلاوة'}</Label>}
  </View>;
}
export function QuranMiniPlayerButton({ onPress, compact = false, accessory = false }: {
  onPress(): void; compact?: boolean; accessory?: boolean;
}): React.JSX.Element | null {
  const player = useQuranPlayer();
  if (player.source !== 'continuous' || !player.current) return null;
  const title = `${surahNames[player.current.surah]}، آية ${player.current.ayah}`;
  return <View style={accessory ? { flex: 1, justifyContent: 'center', paddingHorizontal: 8 } : { padding: 8 }}>
    {compact ? <NativeIconAction title={title} systemImage="radio" onPress={onPress} />
      : <NativeAction title={title} systemImage="radio" onPress={onPress} />}
  </View>;
}
export function QuranMiniPlayerSheet({ visible, onClose, onOpen }: {
  visible: boolean; onClose(): void; onOpen(): void;
}): React.JSX.Element | null {
  const player = useQuranPlayer(), { colors } = useTheme();
  if (player.source !== 'continuous' || !player.current) return null;
  return (
    <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => onClose()}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={contentStyle}><Heading subtitle={recitationByCode(player.recitationCode).nameAr}>إذاعة القرآن</Heading><NativeAction title="تم" onPress={() => onClose()} />
        <Section><QuranWordWindow /><QuranTransport volume /></Section>
        <NativeAction title="الانتقال إلى الراديو" onPress={() => { onClose(); onOpen(); }} />
        <NativeAction title="إيقاف التلاوة" systemImage="stop.fill" onPress={() => { void player.stop().then(() => onClose()).catch(() => undefined); }} />
        {player.error ? <Label style={{ color: colors.danger }}>{player.error}</Label> : null}
      </ScrollView></SafeAreaView></Modal>
  );
}
export function QuranMiniPlayer({ hidden = false, onOpen }: { hidden?: boolean; onOpen(): void }): React.JSX.Element | null {
  const player = useQuranPlayer();
  const [open, setOpen] = useState(false);
  if (hidden || player.source !== 'continuous' || !player.current) return null;
  return <><QuranMiniPlayerButton onPress={() => setOpen(true)} />
    <QuranMiniPlayerSheet visible={open} onClose={() => setOpen(false)} onOpen={onOpen} /></>;
}
