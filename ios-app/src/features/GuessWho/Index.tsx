import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Heading, Label, RequestStatus, SearchField, Section, contentStyle } from '../../components';
import { useResource } from '../../resource';
import { NativeAction, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { guessWhoApi } from './api';
import { getGuestIdentity } from './session';
import { GuessWhoRoom } from './Room';

export function GuessWhoScreen({ params }: FeatureScreenProps): React.JSX.Element {
  return params.room ? <GuessWhoRoom code={params.room} /> : <GuessWhoLobby />;
}
function GuessWhoLobby(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useFeatureNavigation();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [category, setCategory] = useState<number | 'random' | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback((signal: AbortSignal) => guessWhoApi.lobby(signal), []);
  const resource = useResource(load);
  const create = async (): Promise<void> => {
    if (busy || category === null) return;
    setBusy(true); setError(null);
    try { const identity = await getGuestIdentity(); const room = await guessWhoApi.create(category, identity); navigation.open('guesswho', { room }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر إنشاء الغرفة.'); }
    finally { setBusy(false); }
  };
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle}><ProjectIcon name="guesswho" size={48} /><Heading subtitle="تحدّ صديقك، اختر شخصية سرية واستبعد الشخصيات حتى تعرف شخصية خصمك.">مَنْ هُوَ؟</Heading>
    <NativeSegmented options={[{ value: 'create', label: 'إنشاء غرفة' }, { value: 'join', label: 'انضم لصديق' }]} value={tab} onChange={setTab} />
    <RequestStatus resource={resource} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
    {tab === 'create' ? <><Label>اختر الفئة</Label><Pressable accessibilityRole="button" accessibilityState={{ selected: category === 'random' }} onPress={() => setCategory('random')} style={{ padding: 18, borderRadius: 16, backgroundColor: category === 'random' ? colors.accentMuted : colors.surface }}><Label>عشوائي من كل الفئات</Label><Label secondary>{resource.data?.total ?? 0} شخصية</Label></Pressable>
      {resource.data?.categories.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={{ padding: 18, borderRadius: 16, backgroundColor: category === item.id ? colors.accentMuted : colors.surface }}><Label>{item.nameAr}</Label><Label secondary>{item.count} شخصية</Label></Pressable>)}
      <NativeAction title={busy ? 'جارٍ إنشاء الغرفة' : 'أنشئ غرفة اللعب'} prominent disabled={category === null || busy || resource.loading || Boolean(resource.error)} onPress={() => { void create(); }} />
    </> : <Section><SearchField value={code} onChange={setCode} placeholder="رمز الغرفة" /><NativeAction title="انضم للعب" prominent disabled={!code.trim()} onPress={() => { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(code.trim())) setError('رمز الغرفة غير صالح.'); else navigation.open('guesswho', { room: code.trim() }); }} /></Section>}
    <Section><Heading>كيف تلعب؟</Heading><Label>١. يختار كل لاعب شخصية سرية.</Label><Label>٢. تحدث مع صديقك عبر وسيلة اتصال خارجية واطرح أسئلة بنعم أو لا، ثم استبعد الشخصيات.</Label><Label>٣. خمن في دورك. التخمين الصحيح يفوز، والخاطئ ينقل الدور للخصم.</Label><Label secondary>تحتاج اللعبة إلى اتصال بالإنترنت. تحفظ الغرفة حالة دورك وشخصيتك واستبعاداتك، ويتطلب الصوت أو الفيديو تطبيقاً خارجياً.</Label></Section>
    <View style={{ height: 12 }} />
  </ScrollView>;
}
// PORT STATUS: source resources/js/Pages/GuessWho/Index.tsx; confidence medium; todos 1 isolated two-client creation/join verification.
