import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, Heading, Label, RequestStatus, Row, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { useFaithPreferences } from '../../platform/faith-preferences';
import { formatDuration } from '../../platform/dates';
import { useFeatureNavigation } from '../../platform/features';
import { useLocationPreference } from '../../platform/location';
import { usePrayerTimes } from '../../platform/prayer';
import { array, integer, record } from '../../platform/validation';
import { surahNames } from '../../platform/quran/source-rules';
import { useResource } from '../../resource';
import { ProjectIcon } from '../../ui/graphics';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';

export function MuslimScreen(): React.JSX.Element {
  const navigation = useFeatureNavigation(), faith = useFaithPreferences(), location = useLocationPreference(), account = useAccount(), { colors } = useTheme();
  const prayer = usePrayerTimes(location, faith.method, faith.ready);
  const schedule = prayer.schedule({ includeSunrise: false });
  const bookmarks = useResource(useCallback(signal => api.request('quran-bookmarks', value => array(record(value).bookmarks).map(item => {
    const row = record(item); return { surah: integer(row.surah), ayah: integer(row.ayah), page: integer(row.page) };
  }), { authenticated: true, sessionGeneration: account.sessionGeneration, signal }), [account.sessionGeneration]), { enabled: Boolean(account.user) });
  const last = bookmarks.data?.[0];
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>
    <Heading subtitle="أدواتك اليومية في مكان واحد">الركن الإسلامي</Heading>
    <Section style={{ backgroundColor: colors.accentMuted }}><ProjectIcon name="muslim" size={48} />
      <Label style={{ fontSize: 22, lineHeight: 32, fontWeight: '700' }}>{schedule?.next ? `صلاة ${schedule.next.label}` : 'مواقيت الصلاة'}</Label>
      {schedule?.next ? <Label>{schedule.next.time}، المتبقي {formatDuration(schedule.next.remainingMs)}</Label> : null}
      {prayer.data?.hijri ? <Label secondary>{prayer.data.hijri.day} {prayer.data.hijri.month} {prayer.data.hijri.year} هـ</Label> : null}
      <NativeAction title="عرض المواقيت" onPress={() => navigation.open('muslim_prayer')} /></Section>
    <RequestStatus resource={prayer} />
    {last ? <Row title="آخر علامة، تابع القراءة" subtitle={`${surahNames[last.surah] ?? 'سورة'}، آية ${last.ayah}، صفحة ${last.page}`} symbol="bookmark"
      onPress={() => navigation.open('muslim_quran', { surah: String(last.surah), ayah: String(last.ayah), page: String(last.page) })} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {[{ id: 'prayer', title: 'مواقيت الصلاة', icon: 'muslim' }, { id: 'quran', title: 'قارئ القرآن', icon: 'quran' }, { id: 'radio', title: 'إذاعة القرآن', icon: 'quran_radio' }].map(tool =>
        <Section key={tool.id} style={{ flexGrow: 1, flexBasis: 145, alignItems: 'center' }}><ProjectIcon name={tool.icon} size={54} /><NativeAction title={tool.title} onPress={() => navigation.open(`muslim_${tool.id}`)} /></Section>)}
    </View>
    {account.user ? <RequestStatus resource={bookmarks} /> : null}
  </ScrollView>} />;
}
export default MuslimScreen;

// PORT STATUS: source resources/js/Pages/Muslim/Index.tsx; confidence medium; todos 1 iPhone interaction and layout verification.
