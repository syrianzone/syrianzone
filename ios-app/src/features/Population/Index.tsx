import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, Section } from '../../components';
import { openExternal } from '../../platform/links';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeSegmented, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { AtlasMap, PROVINCES } from './AtlasMap';
import { EnvironmentDetails, EnvironmentSummary } from './EnvironmentDetails';
import { decodeAtlas, decodeEnvironment, dynamicThresholds, latestRainfall, provinceValue, toggleComparison, type CountType, type Rainfall } from './model';
import { buildLegend, DATA_TYPE_CONFIG, getColor, GOVERNORATES, type DataType } from './rules';

const COUNT_TYPES: readonly CountType[] = ['population', 'idp', 'idp_returnees'];
const format = (value: number | null) => value === null ? 'لا توجد بيانات' : value.toLocaleString('ar-SY');
export function PopulationScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const atlas = useResource(useCallback(signal => api.request('atlas', decodeAtlas, { signal }), []));
  const environment = useResource(useCallback(signal => api.request('atlas/environment', decodeEnvironment, { signal }), []));
  const [type, setType] = useState<DataType>('population'), [sourceId, setSourceId] = useState<number | null>(null);
  const [mode, setMode] = useState<'data' | 'map'>('data'), [selected, setSelected] = useState(''), [comparison, setComparison] = useState<string[]>([]), [error, setError] = useState<string | null>(null);
  const sources = type === 'rainfall' ? [] : atlas.data?.groups[type] ?? [];
  const source = sources.find(row => row.id === sourceId) ?? sources[0];
  const thresholds = useMemo(() => dynamicThresholds(type, source?.cities ?? null), [type, source]);
  const selectedGovernorate = GOVERNORATES.find(row => row.id === selected);
  const rainfallRows = selectedGovernorate ? atlas.data?.rainfall[selectedGovernorate.pcode] ?? [] : [];
  const selectedEnvironment = environment.data?.cities[selected];
  const countValue = (id: string, countType: CountType = type as CountType) => provinceValue(countType === type ? source : atlas.data?.groups[countType][0], id);
  const value = (id: string): number | null => type === 'environmental' ? typeof environment.data?.cities[id]?.current.temperature_celsius === 'number' ? environment.data.cities[id]!.current.temperature_celsius as number : null : type === 'rainfall' ? latestRainfall(atlas.data?.rainfall[GOVERNORATES.find(row => row.id === id)?.pcode ?? ''] ?? [])?.rainfall ?? null : countValue(id);
  const unit = type === 'rainfall' ? ' مم' : type === 'environmental' ? ' °م' : '';
  const chooseType = (next: DataType) => { setType(next); setSourceId(null); setSelected(''); if (next === 'rainfall') setComparison([]); };
  const chooseProvince = (id: string) => { setSelected(id); setMode('data'); };
  const actions = <View style={{ gap: 12 }}><Heading subtitle="السكان والنزوح والهطول المطري والبيئة">أطلس سوريا التفاعلي</Heading>
    <NativeSegmented label="عرض الأطلس" value={mode} onChange={setMode} options={[{ value: 'data', label: 'البيانات' }, { value: 'map', label: 'الخريطة' }]} />
    <NativePicker label="طبقة البيانات" value={type} onChange={chooseType} options={Object.entries(DATA_TYPE_CONFIG).map(([key, config]) => ({ value: key as DataType, label: config.label }))} />
    <RequestStatus resource={atlas} />{type === 'environmental' ? <RequestStatus resource={environment} /> : null}</View>;
  const legend = <Section><Label style={{ fontWeight: '700' }}>{DATA_TYPE_CONFIG[type].labelAr}</Label>{buildLegend(type, thresholds).map((entry, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ backgroundColor: entry.color, width: 14, height: 14, borderRadius: 7 }} /><Label secondary>{entry.label}</Label></View>)}</Section>;
  const picker = <NativePicker label="اختيار محافظة" value={selected} onChange={chooseProvince} options={[{ value: '', label: 'كل سوريا' }, ...GOVERNORATES.map(row => ({ value: row.id, label: `${row.nameAr}: ${format(value(row.id))}${value(row.id) === null ? '' : unit}` }))]} />;
  const map = <ScrollView contentContainerStyle={contentStyle}>{actions}<AtlasMap selected={selected ? [selected] : comparison} onSelect={chooseProvince}
    fill={id => getColor(value(id) ?? (type === 'environmental' ? NaN : 0), type, thresholds)} label={id => `${PROVINCES.find(row => row.id === id)?.name ?? id}، ${DATA_TYPE_CONFIG[type].label}: ${format(value(id))}${value(id) === null ? '' : unit}`} />
    {legend}{picker}</ScrollView>;
  const open = async (url: string) => { setError(null); try { await openExternal(url); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر فتح المصدر'); } };
  const data = <ScrollView contentContainerStyle={contentStyle}>{actions}{picker}
    {type === 'environmental' ? environment.data ? selected ? selectedEnvironment ? <EnvironmentDetails city={selectedEnvironment} name={selectedGovernorate?.nameAr ?? selected} report={environment.data} /> : <EmptyState title="لا توجد بيانات بيئية لهذه المحافظة" /> : <EnvironmentSummary report={environment.data} /> : null : type === 'rainfall' ? selected ? <RainfallHistory name={selectedGovernorate?.nameAr ?? selected} rows={rainfallRows} /> : <Section><Heading>الهطول المطري</Heading><Label secondary>لون كل محافظة يمثّل آخر سنة متاحة في بيانات المصدر. اختر محافظة لعرض سجلها السنوي ومقارنته بالمتوسط.</Label>{GOVERNORATES.map(row => { const latest = latestRainfall(atlas.data?.rainfall[row.pcode] ?? []); return <Row key={row.id} title={row.nameAr} subtitle={latest ? `${latest.year}: ${format(latest.rainfall)} مم، المتوسط ${format(latest.average)} مم` : 'لا توجد بيانات'} onPress={() => chooseProvince(row.id)} />; })}</Section> : <>
      {sources.length ? <NativePicker label="مصدر البيانات" value={String(source?.id ?? '')} onChange={id => setSourceId(Number(id))} options={sources.map(row => ({ value: String(row.id), label: [row.note || `المصدر ${row.id}`, row.date].filter(Boolean).join('، ') }))} /> : atlas.data ? <EmptyState title="لا تتوفر مصادر لهذه الطبقة" /> : null}
      {source ? <Section><Heading>{DATA_TYPE_CONFIG[type].label}</Heading><Label>{source.note || `المصدر ${source.id}`}</Label><Label secondary>تاريخ المصدر: {source.date ?? 'غير محدد'}</Label><Label style={{ fontWeight: '700' }}>الإجمالي: {format(Object.values(source.cities).reduce((sum, number) => sum + number, 0))}</Label>
        {source.url ? <NativeAction title="فتح المصدر الأصلي" systemImage="arrow.up.right.square" onPress={() => void open(source.url!)} /> : null}</Section> : null}
      {selectedGovernorate ? <Section><Heading>{selectedGovernorate.nameAr}</Heading>{COUNT_TYPES.map(countType => <Label key={countType}>{DATA_TYPE_CONFIG[countType].label}: {format(countValue(selected, countType))}</Label>)}
        <NativeToggle title="تحديد للمقارنة" value={comparison.includes(selected)} onChange={() => setComparison(previous => toggleComparison(previous, selected))} /></Section> : null}
      {comparison.length === 2 ? <Section><Heading>مقارنة المحافظتين</Heading>{COUNT_TYPES.map(countType => { const first = countValue(comparison[0]!, countType), second = countValue(comparison[1]!, countType), max = Math.max(first ?? 0, second ?? 0, 1); return <View key={countType} style={{ gap: 6 }}><Label style={{ fontWeight: '700' }}>{DATA_TYPE_CONFIG[countType].label}</Label>{comparison.map((id, index) => <View key={id}><Label>{GOVERNORATES.find(row => row.id === id)?.nameAr}: {format(index ? second : first)}</Label><View style={{ height: 8, borderRadius: 4, width: `${Math.max(0, (index ? second ?? 0 : first ?? 0) / max * 100)}%`, backgroundColor: index ? colors.secondary : colors.accent }} /></View>)}</View>; })}</Section> : null}
      {source ? <Section><Heading>المحافظات</Heading><Label secondary>اختر محافظتين للمقارنة. اختيار محافظة ثالثة يستبدل الأقدم.</Label><Label>تم اختيار {comparison.length}/2</Label>{comparison.length ? <NativeAction title="مسح المقارنة" onPress={() => setComparison([])} /> : null}
        {GOVERNORATES.map(row => <View key={row.id} style={{ gap: 4 }}><Row title={row.nameAr} subtitle={format(countValue(row.id))} selected={row.id === selected} onPress={() => setSelected(row.id)} /><NativeToggle title={`تحديد ${row.nameAr} للمقارنة`} value={comparison.includes(row.id)} onChange={() => setComparison(previous => toggleComparison(previous, row.id))} /></View>)}</Section> : null}
    </>}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</ScrollView>;
  return <AdaptivePanes primary={data} secondary={map} compact={mode === 'map' ? map : data} />;
}
function RainfallHistory({ name, rows }: { name: string; rows: readonly Rainfall[] }): React.JSX.Element {
  const { colors } = useTheme(); const sorted = [...rows].sort((a, b) => b.year - a.year), max = Math.max(1, ...rows.flatMap(row => [row.rainfall, row.average]));
  return <Section><Heading subtitle="الهطول الفعلي مقارنة بمتوسط المصدر">{name}</Heading>{!rows.length ? <EmptyState title="لا توجد بيانات هطول لهذه المحافظة" /> : <><Label secondary>الأزرق: الهطول الفعلي. الخط: المتوسط.</Label>{sorted.map(row => <View key={row.year} style={{ gap: 4 }}><Label>{row.year}: {row.rainfall.toFixed(1)} مم، المتوسط {row.average.toFixed(1)} مم</Label><Svg width="100%" height={18} viewBox="0 0 500 18" accessible={false}><Rect x={0} y={4} width={row.rainfall / max * 490} height={10} rx={4} fill={DATA_TYPE_CONFIG.rainfall.kind === 'value' ? DATA_TYPE_CONFIG.rainfall.colors.medium : colors.accent} /><Line x1={row.average / max * 490} x2={row.average / max * 490} y1={0} y2={18} stroke={colors.text} strokeWidth={2} /></Svg></View>)}</>}</Section>;
}
// PORT STATUS: source Population/PopulationClient.tsx; confidence medium; todos 0.
