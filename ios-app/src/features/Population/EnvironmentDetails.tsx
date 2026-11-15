import { View } from 'react-native';
import { Heading, Label, Section } from '../../components';
import { NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import type { Environment, EnvironmentalCity, Metrics } from './model';
import { weatherDescription, windDirection } from './model';

export function MetricRows({ values, labels }: { values: Metrics; labels: readonly (readonly [string, string, string?])[] }): React.JSX.Element {
  return <View style={{ gap: 8 }}>{labels.map(([key, label, unit]) => <Label key={key}>{label}: {values[key] == null || values[key] === '' ? 'غير متوفر' : `${values[key]}${unit ? ` ${unit}` : ''}`}</Label>)}</View>;
}
export function EnvironmentSummary({ report }: { report: Environment }): React.JSX.Element {
  return <View style={{ gap: 16 }}><Heading subtitle="اختر محافظة لعرض الطقس والمناخ">البيانات البيئية لسوريا</Heading>
    <Section><Label>المحافظات المحللة: {report.count}</Label><Label>التصنيف المناخي: {report.classification || 'غير متوفر'}</Label></Section>
    {([['النتائج الرئيسية', report.findings], ['التحديات المناخية', report.challenges], ['الأحواض المائية', report.basins], ['التوصيات', report.recommendations]] as const).map(([title, rows]) => rows.length ? <Section key={title}><Heading>{title}</Heading>{rows.map((row, index) => <Label key={index}>{row}</Label>)}</Section> : null)}
    <ReportSources report={report} /></View>;
}
export function ReportSources({ report }: { report: Environment }): React.JSX.Element {
  return <Section><Label secondary>تاريخ التقرير: {report.date || 'غير متوفر'}</Label><Label secondary>المصادر: {report.sources.join('، ') || 'غير متوفرة'}</Label></Section>;
}
export function EnvironmentDetails({ city, name, report }: { city: EnvironmentalCity; name: string; report: Environment }): React.JSX.Element {
  const { colors } = useTheme(); const description = typeof city.current.weather_description === 'string' ? city.current.weather_description : '';
  const icon = /rain|drizzle/i.test(description) ? 'cloud.rain' : /cloud|overcast/i.test(description) ? 'cloud' : /snow/i.test(description) ? 'cloud.snow' : 'sun.max';
  const degrees = typeof city.current.wind_direction_degrees === 'number' ? city.current.wind_direction_degrees : null;
  return <View style={{ gap: 16 }}><Heading>{name}</Heading><Section><NativeSymbol name={icon} size={36} label={weatherDescription(description)} />
    {city.coordinate ? <Label secondary>{city.coordinate.latitude.toFixed(2)}° شمالاً، {city.coordinate.longitude.toFixed(2)}° شرقاً</Label> : null}
    {city.population !== null ? <Label>عدد السكان المرجعي: {city.population.toLocaleString('ar-SY')}</Label> : null}
    <Label style={{ fontSize: 36, lineHeight: 48, fontWeight: '700' }}>{city.current.temperature_celsius ?? 'غير متوفر'} °م</Label>
    <Label>{weatherDescription(description) || 'وصف الطقس غير متوفر'}</Label><Label secondary>المحسوسة: {city.current.feels_like_celsius ?? 'غير متوفر'} °م</Label></Section>
    <Section><Heading>توقعات الغد</Heading><MetricRows values={city.forecast} labels={[
      ['tomorrow_max_temp_c', 'العظمى', '°م'], ['tomorrow_min_temp_c', 'الصغرى', '°م'], ['tomorrow_precipitation_mm', 'الهطول', 'مم']]} /></Section>
    <Section><Heading>الظروف الحالية</Heading><MetricRows values={city.current} labels={[
      ['temperature_celsius', 'الحرارة', '°م'], ['humidity_percent', 'الرطوبة', '%'], ['wind_speed_kmh', 'سرعة الرياح', 'كم/س'], ['pressure_msl_hpa', 'الضغط عند سطح البحر', 'hPa'], ['cloud_cover_percent', 'الغطاء السحابي', '%'], ['precipitation_mm', 'الهطول', 'مم']]} />
      {degrees !== null ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ transform: [{ rotate: `${degrees}deg` }] }}><NativeSymbol name="location.north" size={20} /></View><Label>اتجاه الرياح: {windDirection(degrees)} ({degrees}°)</Label></View> : null}</Section>
    {city.air ? <Section><Heading>جودة الهواء</Heading><Label style={{ fontSize: 28, lineHeight: 38, color: city.air.aqi === null ? colors.secondary : city.air.aqi <= 50 ? colors.success : city.air.aqi <= 100 ? colors.text : colors.danger }}>AQI: {city.air.aqi ?? 'غير متوفر'}</Label>
      <Label>{city.air.category}</Label>{city.air.estimated ? <Label secondary>مؤشر تقديري مبني على بيانات الطقس</Label> : null}<Label>{city.air.recommendation}</Label></Section> : null}
    {city.drought ? <Section><Heading>مخاطر الجفاف</Heading><Label>{city.drought.risk || 'غير متوفر'}</Label><Label>{city.drought.classification}</Label><Label>الهطول السنوي: {city.drought.rainfall ?? 'غير متوفر'} مم</Label><Label>أشهر الموسم الجاف ({city.drought.dryMonths.length}): {city.drought.dryMonths.join('، ') || 'لا توجد بيانات'}</Label><Label>أشهر الموسم الرطب: {city.drought.wetMonths.join('، ') || 'لا توجد بيانات'}</Label></Section> : null}
    {Object.keys(city.climate).length ? <Section><Heading>الاتجاهات المناخية</Heading><MetricRows values={city.climate} labels={[
      ['temperature_trend_celsius', 'اتجاه الحرارة', '°م'], ['temperature_change_rate_per_year', 'معدل التغير السنوي', '°م/سنة'], ['rainfall_trend_mm', 'اتجاه الهطول', 'مم'], ['average_annual_rainfall_mm', 'متوسط الهطول السنوي', 'مم'], ['avg_surface_pressure_hpa', 'متوسط الضغط', 'hPa']]} /></Section> : null}
    {Object.keys(city.historical).length ? <Section><Heading>الملخص التاريخي</Heading><Label secondary>من {city.historical.period_start || 'غير متوفر'} إلى {city.historical.period_end || 'غير متوفر'}</Label><MetricRows values={city.historical} labels={[
      ['avg_min_temp_c', 'متوسط الصغرى', '°م'], ['avg_max_temp_c', 'متوسط العظمى', '°م'], ['total_precipitation_mm', 'إجمالي الهطول', 'مم'], ['max_wind_speed_kmh', 'أقصى سرعة رياح', 'كم/س'], ['avg_surface_pressure_hpa', 'متوسط الضغط السطحي', 'hPa']]} /></Section> : null}
    <ReportSources report={report} /></View>;
}
// PORT STATUS: source Population/PopulationClient.tsx environmental panels; confidence high; todos 0.
