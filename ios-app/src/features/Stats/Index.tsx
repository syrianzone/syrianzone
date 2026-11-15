import { useState } from 'react';
import { ScrollView } from 'react-native';
import { AdaptivePanes, contentStyle, Heading, Label, Section } from '../../components';
import { useFeatureNavigation } from '../../platform/features';
import { openExternal } from '../../platform/links';
import { NativeAction } from '../../ui/native';
import { ProjectIcon } from '../../ui/graphics';
import { useTheme } from '../../ui/theme';
const REPORT = 'https://datastudio.google.com/embed/reporting/65f1f763-c5ab-4841-bfba-bd7403d76645/page/KGHXF';
export function StatsScreen(): React.JSX.Element {
  const navigation = useFeatureNavigation(), [error, setError] = useState<string | null>(null), { colors } = useTheme();
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><Heading subtitle="تقارير وإحصائيات تفاعلية حول التفاعل والنشاط في المساحة السورية">إحصائيات المنصة</Heading>
    <Section><ProjectIcon name="tierlist" size={48} /><NativeAction title="إحصائيات تير ليست الحكومة" onPress={() => navigation.open('tierlist', { view: 'leaderboard' })} /></Section>
    <Section><ProjectIcon name="compass" size={48} /><NativeAction title="إحصاءات بوصلة سوريا" onPress={() => navigation.open('compass', { view: 'stats' })} /></Section>
    <Section><Heading subtitle="بيانات مباشرة ومحدّثة تعكس التفاعل وحركة الزوار عبر أدوات المنصة">تقرير الإحصائيات التفاعلي</Heading><NativeAction title="فتح تقرير Google التفاعلي" systemImage="arrow.up.right" onPress={() => { void openExternal(REPORT).catch(() => setError('تعذر فتح تقرير الإحصائيات.')); }} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</Section>
  </ScrollView>} />;
}
export default StatsScreen;

// PORT STATUS: source resources/js/Pages/Stats.tsx; confidence medium; todos 1 native statistics navigation verification. The source Google report opens through its external action.
