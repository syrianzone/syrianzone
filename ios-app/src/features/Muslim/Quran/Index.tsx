import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AdaptivePanes, contentStyle, Heading, Label, Row, SearchField, Section } from '../../../components';
import { normalizeSearch } from '../../../domain';
import { useQuranPlayer } from '../../../platform/audio';
import { useFaithPreferences } from '../../../platform/faith-preferences';
import type { FeatureScreenProps } from '../../../platform/features';
import { NativeKeyCommands } from '../../../platform/NativeKeyCommands';
import { useQuranBookmarks } from '../../../platform/quran/bookmarks';
import { QuranTransport, RecitationPicker } from '../../../platform/quran/components';
import { useQuranFont } from '../../../platform/quran/fonts';
import { pageForAyah, parseJump, readMushafPage, type QuranPage } from '../../../platform/quran/mushaf';
import { alignWordIndexes, ayahCounts, surahNames, wordsOfText } from '../../../platform/quran/source-rules';
import { QuranUsageCard } from '../../../platform/quran/usage';
import { useResource } from '../../../resource';
import { NativeAction, NativeIconAction } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import MushafPage from '../_components/MushafPage';

export function QuranScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const nativeNavigation = useNavigation();
  const faith = useFaithPreferences(), player = useQuranPlayer(), font = useQuranFont(), bookmarks = useQuranBookmarks(), { colors } = useTheme();
  const [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null), [focus, setFocus] = useState(false);
  const [modal, setModal] = useState<'surahs' | 'bookmarks' | 'jump' | null>(null), [query, setQuery] = useState(''), [jump, setJump] = useState(''), [error, setError] = useState<string | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 }), initialized = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { nativeNavigation.setOptions({ headerShown: !focus }); return () => { nativeNavigation.setOptions({ headerShown: true }); }; }, [nativeNavigation, focus]);
  const { setPreferences } = faith;
  const playingAyah = player.current, playerSource = player.source;
  const savePage = useRef(setPreferences); savePage.current = setPreferences;
  const spread = bounds.width >= 800, step = spread ? 2 : 1;
  const go = useCallback((value: number, key: string | null = null) => {
    const next = Math.max(1, Math.min(604, value)); setPage(next); setSelected(key);
    void savePage.current({ quranPage: next }).catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر حفظ الصفحة.'));
  }, []);
  useEffect(() => {
    if (!faith.ready || initialized.current) return;
    initialized.current = true;
    const surah = Number(params.surah), ayah = Number(params.ayah), target = Number(params.page);
    if (Number.isInteger(target) && target >= 1 && target <= 604) { setPage(target); if (surah && ayah) setSelected(`${surah}:${ayah}`); }
    else if (surah && ayah) void pageForAyah(surah, ayah).then(result => { if (alive.current && result) { setPage(result); setSelected(`${surah}:${ayah}`); } });
    else setPage(faith.quranPage);
  }, [faith.ready, faith.quranPage, params]);
  const pages = useResource(useCallback(async () => Promise.all([page, ...(spread && page < 604 ? [page + 1] : [])].map(readMushafPage)), [page, spread]));
  const ayahs = useMemo(() => pages.data?.flatMap(item => item.ayahs) ?? [], [pages.data]);
  const current = ayahs.find(item => item.key === selected) ?? ayahs[0];
  useEffect(() => {
    const target = playingAyah;
    if (playerSource !== 'reader' || !target || !player.playing) return;
    const key = `${target.surah}:${target.ayah}`;
    setSelected(key);
    if (ayahs.some(item => item.key === key)) return;
    let active = true;
    void pageForAyah(target.surah, target.ayah).then(result => { if (active && result && result !== page) go(result, key); });
    return () => { active = false; };
  }, [playerSource, playingAyah, player.playing, ayahs, page, go]);
  const activeWordKey = useMemo(() => {
    const word = player.activeWord;
    if (!word?.apiWords) return null;
    const ayah = ayahs.find(item => item.surah === word.surah && item.ayah === word.ayah);
    if (!ayah) return null;
    const mapping = alignWordIndexes(wordsOfText(ayah.text), word.apiWords), index = mapping?.[word.position - 1];
    return index !== undefined && index >= 0 ? `${word.surah}:${word.ayah}:${index}` : null;
  }, [player.activeWord, ayahs]);
  function play(key: string): void {
    const ayah = ayahs.find(item => item.key === key);
    if (ayah) void player.playReader({ surah: ayah.surah, ayah: ayah.ayah }).catch(reason => setError(String(reason)));
  }
  function toggle(key: string): void { const ayah = ayahs.find(item => item.key === key); if (ayah) void bookmarks.toggle(ayah); }
  async function submitJump(): Promise<void> {
    const result = await parseJump(jump);
    if (!result) { setError('أدخل صفحة من ١ إلى ٦٠٤ أو سورة وآية مثل ٢:٢٥٥.'); return; }
    go(result.page, result.ayahKey); setModal(null); setError(null); setJump('');
  }
  const surahs = surahNames.map((name, number) => ({ name, number })).filter(item => item.number > 0 && normalizeSearch(`${item.name} ${item.number}`).includes(normalizeSearch(query)));
  function pageView(data: QuranPage): React.JSX.Element {
    return <View key={data.page} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <MushafPage data={data} width={Math.max(0, bounds.width / (spread ? 2 : 1) - 16)} height={Math.max(0, bounds.height - 24)}
        currentAyahKey={current?.key ?? null} savedKeys={bookmarks.keys} bookmarkBusy={bookmarks.busy} activeWordKey={activeWordKey}
        activeWordProgress={player.activeWord?.letterIndex && player.activeWord.letterCount ? player.activeWord.letterIndex / player.activeWord.letterCount : null}
        onSelectAyah={setSelected} onPlayAyah={play} onToggleBookmark={toggle} />
    </View>;
  }
  return <AdaptivePanes primary={<View style={{ flex: 1, backgroundColor: colors.background }}>
    <NativeKeyCommands active={modal === null} commands={['ArrowLeft', 'ArrowRight', 'h', 'l', '[', ']']} onKey={key => { if (key === 'ArrowLeft' || key === 'h') go(page + step); else if (key === 'ArrowRight' || key === 'l') go(page - step); else if (key === '[') go(page - 20); else if (key === ']') go(page + 20); }} />
    <View style={{ paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>{!focus ? <><NativeAction style={{ flex: 1, minWidth: 0 }} title={current ? surahNames[current.surah] ?? 'السور' : 'السور'} onPress={() => { setQuery(''); setModal('surahs'); }} /><NativeIconAction title="العلامات" systemImage="bookmark" onPress={() => setModal('bookmarks')} /><NativeIconAction title="الانتقال وإعدادات التلاوة" systemImage="slider.horizontal.3" onPress={() => setModal('jump')} /></> : <View style={{ flex: 1 }} />}
      <NativeIconAction title={focus ? 'إظهار أدوات القراءة' : 'وضع التركيز'} systemImage={focus ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right'} onPress={() => setFocus(value => !value)} /></View>
    </View>
    <View style={{ flex: 1, minHeight: 100, flexDirection: 'row' }} onLayout={event => setBounds(event.nativeEvent.layout)}>
      {pages.loading || !font.ready ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} accessibilityLabel="جارٍ تجهيز صفحة المصحف" /></View> : pages.data?.map(pageView)}
      {pages.error || font.error ? <View style={{ position: 'absolute', inset: 12 }}><Label style={{ color: colors.danger }}>{pages.error ?? font.error}</Label><NativeAction title="إعادة المحاولة" onPress={() => { font.retry(); pages.reload(); }} /></View> : null}
    </View>
    <View style={{ padding: 10, gap: 7, backgroundColor: colors.surface }}>
      {!focus ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><NativeIconAction title="الصفحة السابقة" systemImage="chevron.right" disabled={page === 1} onPress={() => go(page - step)} /><Label style={{ flex: 1, textAlign: 'center' }}>صفحة {page}{spread && page < 604 ? ` و${page + 1}` : ''} / ٦٠٤، جزء {pages.data?.[0]?.juz ?? ''}</Label><NativeIconAction title="الصفحة التالية" systemImage="chevron.left" disabled={page + step > 604} onPress={() => go(page + step)} /></View> : null}
      <QuranTransport source="reader" onStart={() => { if (current) play(current.key); }} />
      {error || bookmarks.error || faith.error ? <Label style={{ color: colors.danger }}>{error ?? bookmarks.error ?? faith.error}</Label> : null}
    </View>
    <Modal visible={modal !== null} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setModal(null)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={contentStyle}><Heading>{modal === 'surahs' ? 'فهرس السور' : modal === 'bookmarks' ? 'العلامات' : 'الانتقال إلى صفحة أو آية'}</Heading><NativeAction title="تم" onPress={() => setModal(null)} />
        {modal === 'surahs' ? <SearchField value={query} onChange={setQuery} placeholder="اسم السورة أو رقمها" /> : null}</View>
      {modal === 'surahs' ? <FlatList data={surahs} keyExtractor={item => String(item.number)} contentContainerStyle={contentStyle} renderItem={({ item }) => <Row title={`${item.number}. ${item.name}`} subtitle={`${ayahCounts[item.number]} آية`} onPress={() => { void pageForAyah(item.number, 1).then(result => { if (result) go(result, `${item.number}:1`); setModal(null); }); }} />} /> : null}
      {modal === 'bookmarks' ? <FlatList data={bookmarks.items} keyExtractor={item => `${item.surah}:${item.ayah}`} contentContainerStyle={contentStyle} ListEmptyComponent={<Label secondary>{bookmarks.ready ? 'لم تحفظ علامات بعد. حدد آية ثم اضغط حفظ.' : 'جارٍ تحميل العلامات'}</Label>}
        ListHeaderComponent={bookmarks.error ? <Section><Label style={{ color: colors.danger }}>{bookmarks.error}</Label><NativeAction title="إعادة المحاولة" onPress={bookmarks.retry} /></Section> : <View />}
        renderItem={({ item }) => <Section><Row title={surahNames[item.surah] ?? ''} subtitle={`آية ${item.ayah}، صفحة ${item.page}، جزء ${item.juz}`} onPress={() => { go(item.page, `${item.surah}:${item.ayah}`); setModal(null); }} /><NativeAction title="إزالة العلامة" disabled={bookmarks.busy} onPress={() => { void bookmarks.toggle(item); }} /></Section>} /> : null}
      {modal === 'jump' ? <ScrollView contentContainerStyle={contentStyle}><SearchField value={jump} onChange={setJump} placeholder="صفحة أو آية، مثل ١٠٠ أو البقرة ٢٥٥" /><NativeAction title="انتقال" prominent onPress={() => { void submitJump().catch(reason => setError(String(reason))); }} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}<NativeAction title="الجزء السابق" disabled={page === 1} onPress={() => { go(page - 20); setModal(null); }} /><NativeAction title="الجزء التالي" disabled={page === 604} onPress={() => { go(page + 20); setModal(null); }} />{current ? <NativeAction title={bookmarks.keys.has(current.key) ? 'إزالة علامة الآية المحددة' : 'حفظ الآية المحددة'} systemImage={bookmarks.keys.has(current.key) ? 'bookmark.fill' : 'bookmark'} disabled={bookmarks.busy || !bookmarks.ready} onPress={() => toggle(current.key)} /> : null}<RecitationPicker /><QuranTransport volume source="reader" onStart={() => { if (current) play(current.key); }} /><QuranUsageCard /></ScrollView> : null}
    </SafeAreaView></Modal>
  </View>} />;
}
export default QuranScreen;

// PORT STATUS: source resources/js/Pages/Muslim/_components/QuranReader.tsx; confidence medium; todos 2 hardware commands and native glyph/interaction verification.
