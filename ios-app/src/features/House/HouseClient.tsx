import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from '../../components';
import { normalizeSearch } from '../../domain';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { openExternal } from '../../platform/links';
import { AGE_LABEL, archiveUrl, parseHouseCSV, PROVINCES, type ArchiveMode, type ArchiveRow } from './model';

const modes = [{ value: 'voters', label: 'الهيئات الناخبة' }, { value: 'candidates', label: 'المرشحون' }, { value: 'winners', label: 'الفائزون' }, { value: 'presidential', label: 'الثلث الرئاسي' }] as const;
const rowName = (row: ArchiveRow) => row.Name || row['الاسم'] || row.name || 'سجل دون اسم';
function ArchiveCharts({ rows }: { rows: ArchiveRow[] }): React.JSX.Element {
  const { colors } = useTheme();
  const male = rows.filter(row => row.__sexNorm === 'ذكر').length; const female = rows.filter(row => row.__sexNorm === 'أنثى').length; const sum = male + female;
  const buckets = ['lt30', '30s', '40s', '50s', '60p'].map(key => ({ key, count: rows.filter(row => row.__ageGroup === key).length }));
  const maximum = Math.max(1, ...buckets.map(bucket => bucket.count)); const circumference = 2 * Math.PI * 66;
  return <Section><Heading>توزيع الجنس والأعمار</Heading><Label>الإجمالي: {rows.length}، ذكور: {male}، إناث: {female}</Label>
    <Svg width="100%" height={180} viewBox="0 0 340 180" accessibilityRole="image" accessibilityLabel={`ذكور ${male}، إناث ${female}`}><Circle cx={170} cy={88} r={66} stroke={colors.separator} strokeWidth={24} fill="none" />{sum ? <><Circle cx={170} cy={88} r={66} stroke="#556A4E" strokeWidth={24} fill="none" strokeDasharray={`${circumference * male / sum} ${circumference}`} transform="rotate(-90 170 88)" /><Circle cx={170} cy={88} r={66} stroke="#A73F46" strokeWidth={24} fill="none" strokeDasharray={`${circumference * female / sum} ${circumference}`} strokeDashoffset={-circumference * male / sum} transform="rotate(-90 170 88)" /></> : null}<SvgText x={170} y={94} fill={colors.text} fontSize={24} textAnchor="middle">{sum}</SvgText></Svg>
    <Svg width="100%" height={180} viewBox="0 0 340 180" accessibilityRole="image" accessibilityLabel={buckets.map(bucket => `${AGE_LABEL[bucket.key]}: ${bucket.count}`).join('، ')}>{buckets.map((bucket, index) => <ReactChartBar key={bucket.key} index={index} value={bucket.count} maximum={maximum} label={AGE_LABEL[bucket.key] ?? bucket.key} />)}</Svg>
    {buckets.map(bucket => <Label key={bucket.key} secondary>{AGE_LABEL[bucket.key]}: {bucket.count}</Label>)}</Section>;
}
function ReactChartBar({ index, value, maximum, label }: { index: number; value: number; maximum: number; label: string }): React.JSX.Element {
  const { colors } = useTheme(); const height = value / maximum * 120;
  return <><Rect x={20 + index * 64} y={140 - height} width={40} height={height} rx={4} fill={colors.accent} /><SvgText x={40 + index * 64} y={130 - height} fontSize={12} textAnchor="middle" fill={colors.text}>{value}</SvgText><SvgText x={40 + index * 64} y={163} fontSize={11} textAnchor="middle" fill={colors.secondary}>{label}</SvgText></>;
}
export function HouseClient(): React.JSX.Element {
  const { colors } = useTheme();
  const [mode, setMode] = useState<ArchiveMode>('voters'); const [province, setProvince] = useState('damascus');
  const [query, setQuery] = useState(''); const [filters, setFilters] = useState<Record<string, string>>({}); const [sort, setSort] = useState('Name'); const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<ArchiveRow | null>(null); const [showNames, setShowNames] = useState(false); const [error, setError] = useState<string | null>(null);
  const resource = useResource(useCallback(async signal => parseHouseCSV(await api.externalText(archiveUrl(mode, province), { signal })), [mode, province]));
  const sourceRows = useMemo(() => resource.data?.rows ?? [], [resource.data]);
  const results = useMemo(() => sourceRows.filter(row => {
    const search = normalizeSearch(query); const winner = (row['النتيجة'] || row.Result || '').trim() === 'فائز';
    return (!search || `${row.__nameNorm} ${row.__placeNorm}`.includes(search)) && (!filters.sex || row.__sexNorm === filters.sex) && (!filters.age || row.__ageGroup === filters.age)
      && (!filters.appeal || (row.__appealStatus === 'مطعون') === (filters.appeal === 'appealed')) && (!filters.result || winner === (filters.result === 'winner'))
      && (!filters.district || row['Electoral District (الدائرة الانتخابية)'] === filters.district);
  }), [sourceRows, query, filters]);
  const columns = useMemo(() => (resource.data?.headers ?? []).filter(key => !['أسماء جديدة', 'الفائزين'].includes(key) && !key.startsWith('__') && results.some(row => row[key]?.trim())), [resource.data, results]);
  const sorted = useMemo(() => [...results].sort((a, b) => { const first = a[sort] || ''; const second = b[sort] || ''; if (!first && !second) return 0; if (!first) return 1; if (!second) return -1; const numeric = sort.includes('Year') || sort.includes('Age') || sort === 'سنة الميلاد'; const result = numeric ? Number(first.replace(/\D/g, '')) - Number(second.replace(/\D/g, '')) : first.localeCompare(second, 'ar'); return direction === 'asc' ? result : -result; }), [results, sort, direction]);
  const names = useMemo(() => { if (mode !== 'voters') return []; const columnKey = resource.data?.headers.find(header => header.includes('أسماء جديدة')); return columnKey ? results.flatMap(row => (row[columnKey] ?? '').split(/[,،]+/).map(name => name.trim()).filter(Boolean)) : []; }, [resource.data, results, mode]);
  const choose = (key: string, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const picker = (label: string, key: string, options: { value: string; label: string }[]) => <NativePicker label={label} value={filters[key] ?? ''} onChange={value => choose(key, value)} options={[{ value: '', label: 'الكل' }, ...options]} />;
  return <><AdaptivePanes primary={<FlatList data={sorted} keyExtractor={(row, index) => `${rowName(row)}:${index}`} contentContainerStyle={contentStyle} initialNumToRender={12} windowSize={7}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="الهيئات الناخبة والمرشحون والفائزون والثلث الرئاسي">البيانات التاريخية</Heading><Label secondary>المصدر بيانات انتخابية تاريخية، وليست سجل العضوية الحالي.</Label>
      <NativeAction title="الموقع الرسمي للجنة الانتخابات" systemImage="arrow.up.right.square" onPress={() => { void openExternal('https://hcepa.gov.sy').catch(reason => setError(reason instanceof Error ? reason.message : 'تعذّر فتح الرابط')); }} />
      <NativePicker label="القائمة التاريخية" value={mode} onChange={value => { setMode(value); setFilters({}); setQuery(''); setSelected(null); }} options={modes} />{mode === 'voters' ? <NativePicker label="المحافظة" value={province} onChange={setProvince} options={PROVINCES.map(row => ({ value: row.key, label: row.label }))} /> : null}<RequestStatus resource={resource} />
      <SearchField value={query} onChange={setQuery} placeholder="ابحث بالاسم أو المكان" />{picker('الجنس', 'sex', [{ value: 'ذكر', label: 'ذكر' }, { value: 'أنثى', label: 'أنثى' }])}{picker('العمر', 'age', ['lt30', '30s', '40s', '50s', '60p'].map(value => ({ value, label: AGE_LABEL[value] ?? value })))}
      {mode === 'voters' ? picker('حالة الطعن', 'appeal', [{ value: 'appealed', label: 'مطعون' }, { value: 'notAppealed', label: 'سليم' }]) : null}{mode === 'candidates' ? picker('النتيجة', 'result', [{ value: 'winner', label: 'فائز' }, { value: 'notWinner', label: 'غير فائز' }]) : null}{mode === 'winners' ? picker('الدائرة الانتخابية', 'district', [...new Set(sourceRows.map(row => row['Electoral District (الدائرة الانتخابية)']).filter((value): value is string => Boolean(value)))].sort().map(value => ({ value, label: value }))) : null}
      <NativeAction title="مسح البحث والتصفية" onPress={() => { setFilters({}); setQuery(''); }} />
      {mode !== 'candidates' ? <ArchiveCharts rows={results} /> : null}{mode === 'voters' ? <Label secondary>مطعونون: {results.filter(row => row.__appealStatus === 'مطعون').length}</Label> : null}
      {names.length ? <NativeAction title={`أسماء جديدة (${names.length})`} onPress={() => setShowNames(true)} /> : null}
      <NativePicker label="ترتيب حسب" value={columns.includes(sort) ? sort : columns[0] ?? ''} onChange={setSort} options={columns.map(value => ({ value, label: value }))} /><NativeSegmented options={[{ value: 'asc', label: 'تصاعدي' }, { value: 'desc', label: 'تنازلي' }]} value={direction} onChange={setDirection} /><Heading>القائمة الرئيسية ({sorted.length})</Heading>{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>}
    renderItem={({ item }) => <View style={{ marginBottom: 9 }}><Row title={rowName(item)} subtitle={[item.Place || item['المكان'], item.__sexNorm, item.Age ? `العمر ${item.Age}` : '', item.__appealStatus, item['النتيجة'] || item.Result].filter(Boolean).join('، ')} onPress={() => setSelected(item)} /></View>}
    ListEmptyComponent={!resource.loading ? <EmptyState title={resource.data && !sourceRows.length ? 'المصدر فارغ حالياً' : 'لا توجد نتائج مطابقة'} detail="جرّب تغيير التصفية، أو أعد المحاولة إذا لم تتوفر البيانات" /> : <View />} />} />
    <Modal visible={selected !== null} presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}><AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><NativeAction title="إغلاق السجل" systemImage="xmark" onPress={() => setSelected(null)} />{selected ? <><Heading>{rowName(selected)}</Heading>{columns.map(key => selected[key] ? <Section key={key}><Label secondary>{key}</Label><Label>{selected[key]}</Label></Section> : null)}</> : null}</ScrollView>} /></Modal>
    <Modal visible={showNames} presentationStyle="pageSheet" onRequestClose={() => setShowNames(false)}><AdaptivePanes primary={<FlatList data={names} contentContainerStyle={contentStyle} keyExtractor={(name, index) => `${name}:${index}`} ListHeaderComponent={<><NativeAction title="إغلاق الأسماء" systemImage="xmark" onPress={() => setShowNames(false)} /><Heading subtitle="وردت في القوائم النهائية ولم تظهر في القوائم الأولية">أسماء جديدة ({names.length})</Heading></>} renderItem={({ item }) => <Section style={{ marginBottom: 10 }}><Label>{item}</Label></Section>} />} /></Modal></>;
}
// PORT STATUS: source resources/js/Pages/House/HouseClient.tsx; confidence medium; todos 0.
