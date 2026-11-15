import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { STATS_SCOPES } from '../../../../resources/js/Domain/compass/types';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Section } from '../../components';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useResource } from '../../resource';
import { useFeatureNavigation } from '../../platform/features';
import { useAccount, useCan } from '../../platform/account';
import { AxisBars } from './Graphics';
import { decodeStatsPage, questionList } from './model';
import { ALIGN_LABEL, decodeAdminStats } from './admin-model';

export function CompassStatsScreen({ administrative = false }: { administrative?: boolean } = {}): React.JSX.Element {
  const { colors } = useTheme(); const navigation = useFeatureNavigation(); const [scope, setScope] = useState('all');
  const account = useAccount(), allowed = useCan('compass.stats'), canFigures = useCan('compass.figures'), canPersonas = useCan('compass.personas');
  const publicResource = useResource(useCallback(signal => api.page('/compass/stats', 'Compass/Stats', decodeStatsPage, { signal }), []), { enabled: !administrative });
  const adminResource = useResource(useCallback(signal => api.page('/admin/compass', 'Admin/Compass/Index', decodeAdminStats, { signal, authenticated: true, sessionGeneration: account.sessionGeneration }), [account.sessionGeneration]), { enabled: administrative && allowed && account.ready });
  const resource = administrative ? adminResource : publicResource;
  const data = resource.data; const stats = data?.stats;
  const questions = useMemo(() => questionList('full'), []);
  const spectrum = stats?.bySpectrum[scope] ?? stats?.bySpectrum.all ?? [];
  const maximum = Math.max(1, ...spectrum.map(item => item.count));
  return <AdaptivePanes primary={<FlatList data={stats?.total ? questions : []} keyExtractor={question => question.key} contentContainerStyle={contentStyle}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="أرقام عامة مجهولة الهوية من النتائج المشتركة للإحصاء. لا تُعرض بيانات فردية أو معرّفات.">إحصاءات بوصلة سوريا</Heading><NativeAction title="خُض الاختبار" onPress={() => navigation.open('compass')} /><RequestStatus resource={resource} />
      {administrative && !allowed ? <EmptyState title={account.ready ? 'لا تملك صلاحية إحصاءات البوصلة' : 'جارٍ قراءة صلاحيات الحساب'} /> : null}
      {administrative && allowed ? <>{canFigures ? <NativeAction title="إدارة الشخصيات" onPress={() => navigation.open('compass', { view: 'admin-figures' })} /> : null}{canPersonas ? <NativeAction title="إدارة الأنماط" onPress={() => navigation.open('compass', { view: 'admin-personas' })} /> : null}{adminResource.data ? <AdminStatistics data={adminResource.data} /> : null}</> : null}
      {stats?.total ? <><Section><Label style={{ fontWeight: '700', fontSize: 22 }}>إجمالي المشاركات: {stats.total}</Label>{(['short', 'standard', 'full'] as const).map(version => <Label key={version}>{STATS_SCOPES.find(item => item.id === version)?.label}: {stats.byVersion[version] ?? 0}</Label>)}</Section><NativePicker label="المتوسط حسب طول الاختبار" value={scope} onChange={setScope} options={STATS_SCOPES.map(item => ({ value: item.id, label: item.label }))} />
        <Section><Heading subtitle={`${spectrum.reduce((sum, item) => sum + item.count, 0)} مشاركة مصنّفة`}>توزّع الأنماط</Heading>{spectrum.map(item => <View key={item.id}><Label>{data?.personas.find(persona => persona.id === item.id)?.name ?? item.id}: {item.count}</Label><Svg width="100%" height={18} viewBox="0 0 300 18" accessible={false}><Rect x={5} y={5} width={290} height={8} rx={4} fill={colors.separator} /><Rect x={295 - item.count / maximum * 290} y={5} width={item.count / maximum * 290} height={8} rx={4} fill={colors.accent} /></Svg></View>)}</Section>
        <Section><Heading>المتوسط على المحاور</Heading><AxisBars scores={stats.axisAverages[scope] ?? stats.axisAverages.all ?? {}} /></Section><Heading>متوسط الإجابات عن كل سؤال</Heading></> : null}</View>}
    renderItem={({ item: question }) => {
      const distribution = stats?.questions[question.key]?.[scope];
      const average = distribution?.n ? distribution.counts.reduce((sum, count, index) => sum + count * (index - 2), 0) / distribution.n : null;
      const colorsByChoice = [colors.danger, colors.secondary, colors.separator, colors.accentMuted, colors.accent];
      let position = 5;
      return <Section style={{ marginVertical: 8 }}><Label secondary>{question.section}</Label><Label>{question.text}</Label><Label secondary>{distribution?.n ?? 0} إجابة، المتوسط {average == null ? 'غير متوفر' : average.toFixed(2)}</Label>{distribution?.n ? <Svg width="100%" height={20} viewBox="0 0 300 20" accessibilityRole="image" accessibilityLabel={distribution.counts.map((count, index) => `الإجابة ${index - 2}: ${count}`).join('، ')}>{distribution.counts.map((count, index) => { const width = count / distribution.n * 290; const x = position; position += width; return <Rect key={index} x={x} y={5} width={width} height={10} fill={colorsByChoice[index]!} />; })}</Svg> : null}</Section>;
    }} ListEmptyComponent={stats && !stats.total ? <EmptyState title="لا توجد إحصاءات بعد" /> : <View />} />} />;
}
function AdminStatistics({ data }: { data: ReturnType<typeof decodeAdminStats> }): React.JSX.Element {
  const { colors } = useTheme(); const maximum = Math.max(1, ...data.daily.map(day => day.count)); const alignMax = Math.max(1, ...Object.values(data.alignTotals));
  return <><Section><Heading>ملخّص الإدارة</Heading><Label>آخر7 أيام: {data.last7}</Label><Label>آخر30 يوماً: {data.last30}</Label><Label>متوسط الاتساق: {data.avgConsistency === null ? 'غير متوفر' : `${Math.round(data.avgConsistency * 100)}%`}</Label><Label>متوسط الأسئلة المجابة: {data.avgAnswered ?? 'غير متوفر'}</Label></Section>
    <Section><Heading>التوجّه الخارجي العام</Heading>{Object.entries(data.alignTotals).map(([key, value]) => <View key={key}><Label>{ALIGN_LABEL[key] ?? key}: {value}</Label><View style={{ height: 8, borderRadius: 4, width: `${Math.max(0, value / alignMax * 100)}%`, backgroundColor: colors.accent }} /></View>)}</Section>
    <Section><Heading>المشاركات اليومية</Heading>{data.daily.length ? <><Svg width="100%" height={130} viewBox="0 0 360 130" accessibilityRole="image" accessibilityLabel={data.daily.map(day => `${day.date}: ${day.count}`).join('، ')}>{data.daily.map((day, index) => <Rect key={day.date} x={index / data.daily.length * 360} y={120 - day.count / maximum * 110} width={Math.max(1, 360 / data.daily.length - 2)} height={day.count / maximum * 110} fill={colors.accent} />)}</Svg>{data.daily.map(day => <Label key={day.date} secondary>{day.date}: {day.count}</Label>)}</> : <Label secondary>لا توجد بيانات بعد</Label>}</Section>
    <Section><Heading subtitle="نتائج مجهولة الهوية، دون حسابات أو إجابات شخصية">آخر المشاركات</Heading>{data.recent.length ? data.recent.map(row => <Section key={row.id}><Label>{row.createdAt ? new Date(row.createdAt).toLocaleString('ar-SY', { timeZone: 'Asia/Damascus' }) : 'تاريخ غير متوفر'}</Label><Label>{STATS_SCOPES.find(item => item.id === row.version)?.label}: {data.personas.find(persona => persona.id === row.spectrum)?.name ?? 'نمط غير محدد'}</Label><Label secondary>{row.answered} سؤالاً، الاتساق {row.consistency === null ? 'غير متوفر' : `${Math.round(row.consistency * 100)}%`}، أقرب توافق {row.topScore === null ? 'غير متوفر' : `${Math.round(row.topScore * 100)}%`}</Label></Section>) : <Label secondary>لا توجد مشاركات بعد</Label>}</Section></>;
}
// PORT STATUS: source resources/js/Pages/Compass/Stats.tsx and Domain/compass/QuestionAverage.tsx; confidence medium; todos 0.
