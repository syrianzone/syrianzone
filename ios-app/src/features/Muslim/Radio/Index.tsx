import { useState } from 'react';
import { ScrollView } from 'react-native';
import { AdaptivePanes, contentStyle, Heading, Label, Section } from '../../../components';
import { useQuranPlayer } from '../../../platform/audio';
import { useForegroundClock } from '../../../platform/clock';
import { formatDuration } from '../../../platform/dates';
import { useFeatureNavigation } from '../../../platform/features';
import { QuranTransport, QuranWordWindow, RecitationPicker } from '../../../platform/quran/components';
import { pageForAyah } from '../../../platform/quran/mushaf';
import { QuranUsageCard } from '../../../platform/quran/usage';
import { ProjectIcon } from '../../../ui/graphics';
import { NativeAction, NativePicker } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';

const options = [{ value: 'none', label: 'بدون' }, { value: '15', label: '١٥ دقيقة' }, { value: '30', label: '٣٠ دقيقة' }, { value: '45', label: '٤٥ دقيقة' }, { value: '60', label: 'ساعة' }, { value: '90', label: 'ساعة ونصف' }];
export function RadioScreen(): React.JSX.Element {
  const player = useQuranPlayer(), navigation = useFeatureNavigation(), now = useForegroundClock(), { colors } = useTheme();
  const [error, setError] = useState<string | null>(null), [preset, setPreset] = useState('none');
  async function timer(value: string): Promise<void> {
    if (value === 'active') return;
    try { await player.setSleepUntil(value === 'none' ? null : Date.now() + Number(value) * 60000); setPreset(value); setError(null); }
    catch { setError('تعذر ضبط مؤقت النوم. حاول مجدداً.'); }
  }
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>
    <Heading subtitle="تلاوة متابَعة تستمر عند الانتقال بين أقسام التطبيق">إذاعة القرآن</Heading>
    <Section><ProjectIcon name="quran_radio" size={72} /><QuranWordWindow /><QuranTransport volume /><RecitationPicker />
      <NativeAction title="أكمل في القارئ" systemImage="book" disabled={!player.current} onPress={() => {
        const current = player.current;
        if (current) void pageForAyah(current.surah, current.ayah).then(page => navigation.open('muslim_quran', { surah: String(current.surah), ayah: String(current.ayah), ...(page ? { page: String(page) } : {}) })).catch(() => setError('تعذر فتح موضع القراءة.'));
      }} /></Section>
    <Section><Label style={{ fontWeight: '700' }}>مؤقت النوم</Label>
      <NativePicker label="مدة مؤقت النوم" value={player.sleepUntil === null ? 'none' : preset === 'none' ? 'active' : preset} options={player.sleepUntil !== null && preset === 'none' ? [...options, { value: 'active', label: 'مؤقت قائم' }] : options} onChange={value => { void timer(value); }} />
      {player.sleepUntil !== null ? <Label>{formatDuration(Math.max(0, player.sleepUntil - now.getTime()))}</Label> : null}
      <Label secondary>{player.current ? 'تتوقف التلاوة تلقائياً عند انتهاء المهلة، حتى عند مغادرة هذه الصفحة.' : 'اضغط تشغيل لبدء التلاوة.'}</Label>
      {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</Section>
    <QuranUsageCard />
  </ScrollView>} />;
}
export default RadioScreen;

// PORT STATUS: source resources/js/Pages/Muslim/_components/RadioView.tsx; confidence medium; todos 1 native background, remote controls and sleep lifecycle verification.
