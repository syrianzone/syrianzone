import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, ScrollView, View } from 'react-native';
import { DatePicker } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, FormField, Heading, Label, RequestStatus, Row, SearchField } from '../../components';
import { imageFormData, pickImage } from '../../platform/uploads';
import { assetUrl, record } from '../../platform/validation';
import { useResource } from '../../resource';
import { NativeAction, NativeThemeHost, NativeToggle } from '../../ui/native';
import { assertAdminSuccess, type PromiseAdmin } from './AdminShared';
import { decodeSpeakers, type SpeakerOption } from './model';

const localDate = (value: string): Date => { const [year = 2026, month = 1, day = 1] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); };
const dateString = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function AdminDate({ label, value, onChange, today, earliest, latest, optional = false, busy = false }: { label: string; value: string; onChange(value: string): void; today: string; earliest?: string; latest?: string; optional?: boolean; busy?: boolean }): React.JSX.Element {
  return <View style={{ gap: 6 }}><Label>{label}</Label>{optional ? <NativeToggle title={`تحديد ${label}`} value={Boolean(value)} onChange={enabled => onChange(enabled ? today : '')} disabled={busy} /> : !value ? <NativeAction title={`اختيار ${label}`} disabled={busy} onPress={() => onChange(today)} /> : null}{value ? <NativeThemeHost matchContents={{ vertical: true }}><DatePicker title={label} selection={localDate(value)} displayedComponents={['date']} onDateChange={date => onChange(dateString(date))} {...(earliest || latest ? { range: { ...(earliest ? { start: localDate(earliest) } : {}), ...(latest ? { end: localDate(latest) } : {}) } } : {})} modifiers={[disabled(busy)]} /></NativeThemeHost> : null}</View>;
}
export function AdminSpeakerPicker({ label, value, onChange, manager }: { label: string; value: SpeakerOption | null; onChange(value: SpeakerOption): void; manager: PromiseAdmin }): React.JSX.Element {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [debounced, setDebounced] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(timer); }, [query]);
  const resource = useResource(useCallback(signal => api.request('admin/promises/speakers/search', decodeSpeakers, { params: { q: debounced }, authenticated: true, signal, sessionGeneration: manager.account.sessionGeneration }), [debounced, manager.account.sessionGeneration]), { enabled: open && manager.any });
  return <><Label>{label}: {value ? `${value.name}${value.pending ? ' (بانتظار الاعتماد)' : ''}` : 'غير محدد'}</Label><NativeAction title={`اختيار ${label}`} systemImage="person.crop.circle.badge.checkmark" onPress={() => setOpen(true)} disabled={manager.busy} /><Modal visible={open} presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>{open ? <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"><Heading>{label}</Heading><NativeAction title="إغلاق اختيار المسؤول" onPress={() => setOpen(false)} /><Label>بحث في المسؤولين والأدلة</Label><SearchField placeholder="بحث في المسؤولين والأدلة" value={query} onChange={setQuery} /><RequestStatus resource={resource} />{resource.data?.map(option => <Row key={option.ref} title={option.name} subtitle={`${option.title ?? ''}${option.pending ? '، بانتظار الاعتماد' : ''}`} selected={value?.ref === option.ref} onPress={() => { onChange(option); setOpen(false); }} />)}{resource.data && !resource.data.length ? <EmptyState title="لا توجد أسماء مطابقة" /> : null}</ScrollView>} /> : null}</Modal></>;
}
export function AdminImage({ value, onChange, kind, manager }: { value: string; onChange(value: string): void; kind: 'source' | 'speaker'; manager: PromiseAdmin }): React.JSX.Element {
  const canUpload = kind === 'speaker' ? manager.speakers : manager.edit;
  return <View style={{ gap: 8 }}>{value ? <><Image source={{ uri: value }} style={{ width: '100%', height: 160, borderRadius: 12 }} contentFit="contain" accessibilityLabel={kind === 'speaker' ? 'صورة المسؤول' : 'لقطة المصدر'} /><NativeAction title="إزالة الصورة" onPress={() => onChange('')} disabled={manager.busy} /></> : null}<FormField label={kind === 'speaker' ? 'رابط صورة المسؤول' : 'رابط لقطة المصدر'} value={value} onChange={onChange} keyboardType="url" disabled={manager.busy} />
    {canUpload ? <NativeAction title="اختيار صورة ورفعها" systemImage="photo.badge.plus" disabled={manager.busy} onPress={() => void manager.run(async generation => {
      const bounds = { maxBytes: 8 * 1024 * 1024 }; const asset = await pickImage(bounds);
      if (!asset) return;
      const body = imageFormData('image', asset, bounds); body.append('kind', kind);
      const url = await api.request(`admin/promises/${kind === 'speaker' ? 'speakers/' : ''}upload-image`, raw => { assertAdminSuccess(raw); const image = assetUrl(record(raw).url); if (!image) throw new Error('لم يُرجع الخادم صورة صالحة'); return image; }, { method: 'POST', authenticated: true, sessionGeneration: generation, body });
      if (api.getSessionGeneration() === generation) onChange(url);
    })} /> : null}</View>;
}
// PORT STATUS: source Admin/Promises/_components/SourcesEditor.tsx and Domain/promises/SpeakerPicker.tsx; confidence medium; todos 0.
