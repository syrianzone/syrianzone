import { View } from 'react-native';
import { FormField, Heading, Label, Section } from '../../components';
import { NativeAction, NativePicker } from '../../ui/native';
import { AdminDate, AdminImage } from './AdminFields';
import { emptySource } from './admin-model';
import type { PromiseAdmin } from './AdminShared';
import type { SourceForm } from './admin-types';
import { SOURCE_LABEL } from './model';

export function AdminSources({ sources, onChange, types, today, manager, readonly }: { sources: SourceForm[]; onChange(update: (sources: SourceForm[]) => SourceForm[]): void; types: string[]; today: string; manager: PromiseAdmin; readonly: boolean }): React.JSX.Element {
  const update = (key: string, patch: Partial<SourceForm>) => onChange(previous => previous.map(source => source.key === key ? { ...source, ...patch } : source));
  const busy = manager.busy || readonly;
  return <View style={{ gap: 16 }}><Heading subtitle="مصدر واحد إلى عشرين مصدراً، ولكل مصدر بياناته وتاريخه">المصادر</Heading>{sources.map((source, index) => <Section key={source.key}><Label style={{ fontWeight: '700' }}>المصدر {index + 1}{source.isPrimary ? '، الأساسي' : ''}</Label>
    <FormField label={`المصدر ${index + 1}: الرابط`} value={source.url} onChange={url => update(source.key, { url })} keyboardType="url" disabled={busy} maxLength={2048} /><FormField label="اسم الجهة الناشرة" value={source.outlet} onChange={outlet => update(source.key, { outlet })} disabled={busy} maxLength={255} />
    <NativePicker label="نوع المصدر" value={source.type} onChange={type => update(source.key, { type })} disabled={busy} options={types.map(value => ({ value, label: SOURCE_LABEL[value] ?? value }))} /><AdminDate label="تاريخ نشر المصدر" value={source.publishedDate} onChange={publishedDate => update(source.key, { publishedDate })} today={today} optional busy={busy} /><NativePicker label="لغة المصدر" value={source.language} onChange={language => update(source.key, { language })} disabled={busy} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'الإنجليزية' }, { value: 'other', label: 'أخرى' }]} />
    <FormField label="النسخة المؤرشفة" value={source.archiveUrl} onChange={archiveUrl => update(source.key, { archiveUrl })} disabled={busy} keyboardType="url" maxLength={2048} /><FormField label="وقت الفيديو، مثال12:34 أو1:02:03" value={source.videoTimestamp} onChange={videoTimestamp => update(source.key, { videoTimestamp })} disabled={busy} keyboardType="numbers-and-punctuation" maxLength={16} />
    {!readonly ? <AdminImage kind="source" value={source.screenshotUrl} onChange={screenshotUrl => update(source.key, { screenshotUrl })} manager={manager} /> : source.screenshotUrl ? <Label secondary>لقطة المصدر: {source.screenshotUrl}</Label> : null}
    <NativeAction title={source.isPrimary ? 'هذا هو المصدر الأساسي' : 'تعيين مصدراً أساسياً'} disabled={busy || source.isPrimary} onPress={() => onChange(previous => previous.map(row => ({ ...row, isPrimary: row.key === source.key })))} /><NativeAction title={`إزالة المصدر ${index + 1}`} destructive disabled={busy} onPress={() => onChange(previous => previous.filter(row => row.key !== source.key))} /></Section>)}<NativeAction title="إضافة مصدر" systemImage="plus" disabled={busy || sources.length >= 20} onPress={() => onChange(previous => [...previous, { ...emptySource(), isPrimary: previous.length === 0 }])} /></View>;
}
// PORT STATUS: source Admin/Promises/_components/SourcesEditor.tsx; confidence medium; todos 0.
