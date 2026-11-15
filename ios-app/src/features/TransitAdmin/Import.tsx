import { useState, type ReactNode } from 'react';
import { File } from 'expo-file-system';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import { AdaptivePanes, contentStyle, EmptyState, FormField, Heading, Label, Section } from '../../components';
import type { City } from '../../domain';
import { documentFormData, pickDocument, type SelectedDocument } from '../../platform/documents';
import { NativeAction, NativePicker } from '../../ui/native';
import { transitAdminClient as client } from './api';
import { importForm, importPayload, validateImportFile, type ImportForm, type ImportPreview } from './model';
import { AdminSheet, CityPicker, GeometryMap, Messages, type TransitManager } from './Shared';
import { RouteFields } from './RouteTools';

export function TransitImport({
  cities,
  manager,
  header,
  onDraft,
  onPublished
}: {
  cities: readonly City[];
  manager: TransitManager;
  header: ReactNode;
  onDraft(id: number): void;
  onPublished(route: { id: string; cityId: string }): void;
}): React.JSX.Element {
  const [url, setUrl] = useState(''),
    [file, setFile] = useState<SelectedDocument | null>(null),
    [override, setOverride] = useState('auto');
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [index, setIndex] = useState(0),
    [form, setForm] = useState<ImportForm | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null),
    [confirmDirect, setConfirmDirect] = useState(false);
  const [editingStops, setEditingStops] = useState(false);
  const selected = preview?.candidates[index] ?? null,
    canPreview = manager.can('transit.review_drafts');
  const canPublish = Boolean(form && manager.can('transit.edit_routes', [form.cityId]));
  const update = (patch: Partial<ImportForm>) => {
    setForm((previous) => (previous ? { ...previous, ...patch } : previous));
    setCreatedId(null);
  };
  const choose = async () => {
    const result: { file: SelectedDocument | null } = { file: null };
    const success = await manager.perform('transit.review_drafts', [], async () => {
      result.file = await pickDocument();
      if (result.file) validateImportFile(result.file);
      return null;
    });
    if (success && result.file) setFile(result.file);
  };
  const fetchPreview = async () => {
    const result: { preview: ImportPreview | null } = { preview: null };
    const success = await manager.perform('transit.review_drafts', override === 'auto' ? [] : [override], async (generation) => {
      if (!url.trim() && !file) throw new Error('الصق رابط My Maps أو اختر ملفاً أولاً.');
      let body: FormData | { url: string; city_id?: string };
      if (file) {
        validateImportFile({ ...file, size: new File(file.uri).size });
        body = documentFormData('file', file);
        if (url.trim()) body.append('url', url.trim());
        if (override !== 'auto') body.append('city_id', override);
      } else body = { url: url.trim(), ...(override !== 'auto' ? { city_id: override } : {}) };
      result.preview = await client.preview(body, generation);
      if (!result.preview.candidates.length) throw new Error('لم يتم العثور على خطوط ضمن نطاق صلاحياتك في هذه الخريطة.');
      return `تم جلب ${result.preview.candidates.length} خط للمعاينة.`;
    });
    if (success && result.preview) {
      setPreview(result.preview);
      setIndex(0);
      setCreatedId(null);
      const first = result.preview.candidates[0]!;
      setForm(importForm(first, override !== 'auto' ? override : (first.suggestedCity ?? String(cities[0]?.id ?? ''))));
    }
  };
  const publish = async (mode: 'draft' | 'direct') => {
    if (!selected || !form) return;
    const result: { data: { draftId: number | null; route: { id: string; cityId: string } | null } | null } = { data: null };
    const success = await manager.perform('transit.edit_routes', [form.cityId], async (generation) => {
      result.data = await client.publish(importPayload(selected, form, mode, preview?.mid ?? null), generation);
      return mode === 'draft' ? 'تم إنشاء المسودة للمراجعة.' : 'تم نشر الخط المستورد.';
    });
    if (!success || !result.data) return;
    setConfirmDirect(false);
    if (mode === 'draft') setCreatedId(result.data.draftId);
    else if (result.data.route) {
      setPreview(null);
      setForm(null);
      onPublished(result.data.route);
    }
  };
  const map =
    selected && form ? (
      <GeometryMap geometry={{ ...selected.geometry, stops: form.stops }} cityId={form.cityId} color={form.color} />
    ) : (
      <EmptyState symbol="map" title="اختر خريطة أو ملفاً لمعاينة المسار" />
    );
  const fields = (
    <View style={{ gap: 16 }}>
      <Section>
        <Heading>1. مصدر الاستيراد</Heading>
        <FormField
          label="رابط Google My Maps أو معرّف الخريطة"
          value={url}
          onChange={setUrl}
          keyboardType="url"
          maxLength={2048}
          disabled={manager.busy}
        />
        <NativeAction
          title={file ? `الملف: ${file.name}` : 'اختيار ملف KML أو KMZ أو GeoJSON'}
          systemImage="folder"
          onPress={() => void choose()}
          disabled={manager.busy}
        />
        {file ? <NativeAction title="إزالة الملف المحدد" onPress={() => setFile(null)} disabled={manager.busy} /> : null}
        <NativePicker
          label="مدينة الاستيراد"
          value={override}
          onChange={(value) => {
            setOverride(value);
            if (value !== 'auto') update({ cityId: value });
            else if (selected) update({ cityId: selected.suggestedCity ?? String(cities[0]?.id ?? '') });
          }}
          disabled={manager.busy}
          options={[
            { value: 'auto', label: 'تحديد المدينة تلقائياً من الحدود' },
            ...cities.map((city) => ({ value: String(city.id), label: city.nameAr }))
          ]}
        />
        <Label secondary>الحد الأقصى 5 ميغابايت. تُعاين الخرائط الخاصة برفع ملفها من تطبيق الملفات.</Label>
        <NativeAction title="جلب الخطوط للمعاينة" prominent disabled={manager.busy || !canPreview} onPress={() => void fetchPreview()} />
      </Section>
      {preview ? (
        <>
          <Label>
            {preview.candidates.length} خط، {preview.filtered} خط خارج نطاق الصلاحيات.
          </Label>
          <NativePicker
            label="الخط المستورد"
            value={String(index)}
            disabled={manager.busy}
            options={preview.candidates.map((candidate, position) => ({ value: String(position), label: `${position + 1}. ${candidate.name}` }))}
            onChange={(value) => {
              const position = Number(value),
                candidate = preview.candidates[position];
              if (!candidate) return;
              setIndex(position);
              setForm(importForm(candidate, override !== 'auto' ? override : (candidate.suggestedCity ?? String(cities[0]?.id ?? ''))));
              setCreatedId(null);
            }}
          />
        </>
      ) : null}
      {selected && form ? (
        <>
          <Section>
            <Heading>2. راجع وعدّل قبل النشر</Heading>
            <Label>
              {selected.vertexCount} نقطة، {form.stops.length} محطة
            </Label>
            {selected.warnings.map((warning, position) => (
              <Label key={position} style={{ color: manager.colors.danger }}>
                {warning}
              </Label>
            ))}
            <RouteFields form={form} update={update} manager={manager} />
            <CityPicker cities={cities} value={form.cityId} onChange={(cityId) => update({ cityId })} disabled={manager.busy} />
            <FormField
              label="ملاحظات"
              value={form.notes}
              onChange={(notes) => update({ notes })}
              multiline
              maxLength={5000}
              disabled={manager.busy}
            />
            <Heading>المحطات</Heading>
            {form.stops.length ? (
              <NativeAction
                title={`تعديل أسماء ${form.stops.length} محطة أو إزالتها`}
                disabled={manager.busy}
                onPress={() => setEditingStops(true)}
              />
            ) : (
              <Label secondary>سيُنشر الخط دون مواقف.</Label>
            )}
            <Label secondary>
              المصدر: {selected.source || 'My Maps'}
              {preview?.mid ? `، mid: ${preview.mid}` : ''}
            </Label>
            {selected.sourceDescription ? <Label secondary>{selected.sourceDescription}</Label> : null}
          </Section>
          <Section>
            <Heading>3. النشر</Heading>
            {createdId ? (
              <>
                <Label>تم إنشاء المسودة #{createdId}. الموافقة عليها مطلوبة للنشر.</Label>
                <NativeAction title="الانتقال للمسودة للمراجعة" onPress={() => onDraft(createdId)} />
              </>
            ) : (
              <>
                <NativeAction title="حفظ كمسودة للمراجعة" prominent disabled={manager.busy || !canPublish} onPress={() => void publish('draft')} />
                <NativeAction title="نشر مباشر دون مراجعة" disabled={manager.busy || !canPublish} onPress={() => setConfirmDirect(true)} />
                <Label secondary>
                  {canPublish
                    ? 'المسودة تمر عبر الموافقة المعتادة. النشر المباشر للعمل الموثوق فقط.'
                    : 'يلزم امتلاك صلاحية تعديل الخطوط في المدينة المحددة للنشر أو حفظ مسودة الاستيراد.'}
                </Label>
              </>
            )}
          </Section>
        </>
      ) : null}
      <Messages manager={manager} />
    </View>
  );
  if (!canPreview)
    return (
      <AdaptivePanes
        primary={
          <ScrollView contentContainerStyle={contentStyle}>
            {header}
            <EmptyState title="تحتاج صلاحية مراجعة المسودات لمعاينة الاستيراد" />
          </ScrollView>
        }
      />
    );
  return (
    <>
      <AdaptivePanes
        primary={
          <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
            {header}
            {fields}
          </ScrollView>
        }
        secondary={<ScrollView contentContainerStyle={contentStyle}>{map}</ScrollView>}
        compact={
          <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
            {header}
            {selected ? map : null}
            {fields}
          </ScrollView>
        }
      />
      <AdminSheet title="تأكيد النشر المباشر" visible={confirmDirect && canPublish} busy={manager.busy} onClose={() => setConfirmDirect(false)}>
        <Label>سيظهر «{form?.nameAr}» فوراً على الخريطة العامة دون المرور بالمراجعة.</Label>
        <Messages manager={manager} />
        <NativeAction title="تأكيد النشر المباشر" prominent disabled={manager.busy || !canPublish} onPress={() => void publish('direct')} />
      </AdminSheet>
      <Modal visible={editingStops && canPreview} presentationStyle="pageSheet" onRequestClose={() => setEditingStops(false)}>
        <View style={{ flex: 1, backgroundColor: manager.colors.background }}>
          <AdaptivePanes
            primary={
              <FlatList
                data={form?.stops ?? []}
                keyExtractor={(_, position) => String(position)}
                contentContainerStyle={contentStyle}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View style={{ gap: 12 }}>
                    <Heading>محطات الاستيراد</Heading>
                    <NativeAction title="تم" onPress={() => setEditingStops(false)} />
                  </View>
                }
                renderItem={({ item: stop, index: position }) => (
                  <Section style={{ marginVertical: 6 }}>
                    <FormField
                      label={`اسم المحطة ${position + 1}`}
                      value={stop.name}
                      onChange={(name) => {
                        if (form) update({ stops: form.stops.map((item, offset) => (offset === position ? { ...item, name } : item)) });
                      }}
                      disabled={manager.busy}
                    />
                    <NativeAction
                      title={`إزالة المحطة ${position + 1} من الاستيراد`}
                      disabled={manager.busy}
                      onPress={() => {
                        if (form) update({ stops: form.stops.filter((_, offset) => offset !== position) });
                      }}
                    />
                  </Section>
                )}
                ListEmptyComponent={<Label>لا توجد محطات. سيُنشر الخط دون مواقف.</Label>}
              />
            }
          />
        </View>
      </Modal>
    </>
  );
}
// PORT STATUS: source Transit/admin/ImportTab.tsx; confidence medium; todos 1 native Files and controlled import verification.
