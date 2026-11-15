import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '../../api';
import { FormField, Heading, Label, RequestStatus, Section } from '../../components';
import type { City } from '../../domain';
import { useFeatureNavigation } from '../../platform/features';
import { useResource } from '../../resource';
import { NativeAction, NativePicker } from '../../ui/native';
import { transitAdminClient as client } from './api';
import { combinePayload, DRAFT_LABELS, ROUTE_LABELS, routePayload, splitPayload, type Draft, type PublishedRoute, type RouteForm } from './model';
import { AdminSheet, CityPicker, ColorPicker, Messages, type TransitManager } from './Shared';
import type { DraftEditor, RouteEditor } from './editor-state';

export function DraftReview({
  draft,
  manager,
  editor,
  onReviewed
}: {
  draft: Draft;
  manager: TransitManager;
  editor: DraftEditor;
  onReviewed(): void;
}): React.JSX.Element {
  const navigation = useFeatureNavigation(),
    { color, rejecting, reason } = editor.state;
  const setColor = (value: number) => editor.update({ color: value });
  const setRejecting = (value: boolean) => editor.update({ rejecting: value });
  const setReason = (value: string) => editor.update({ reason: value });
  const canApprove = manager.can('transit.approve', [draft.cityId]),
    canReject = manager.can('transit.reject', [draft.cityId]);
  const decide = async (reject: boolean) => {
    const success = await manager.perform(reject ? 'transit.reject' : 'transit.approve', [draft.cityId], async (generation) => {
      if (reject) await client.reject(draft.id, reason.trim() || null, generation);
      else await client.approve(draft.id, color, generation);
      return reject ? 'تم رفض المسار.' : 'تمت الموافقة على المسار ونشره.';
    });
    if (success) {
      setRejecting(false);
      onReviewed();
    }
  };
  return (
    <Section>
      <Heading>{draft.name}</Heading>
      {draft.nameEn ? <Label secondary>{draft.nameEn}</Label> : null}
      <Label>
        {DRAFT_LABELS[draft.status]}، {draft.city ?? draft.cityId}
      </Label>
      <Label>
        المساهم: {draft.user ?? 'مجهول'}، التعرفة: {draft.price == null ? 'غير محددة' : `${draft.price} ل.س`}
      </Label>
      <Label>{draft.geometry.stops.length} محطة</Label>
      {draft.routeId ? <Label>تعديل مقترح للخط: {draft.linkedName ?? draft.routeId}. الموافقة تطبق التعديلات وتنشر الخط.</Label> : null}
      {draft.notes ? <Label>{draft.notes}</Label> : null}
      {draft.rejection ? <Label>سبب الرفض: {draft.rejection}</Label> : null}
      {draft.status === 'pending' ? (
        <>
          {canApprove ? (
            <>
              <ColorPicker value={color} onChange={setColor} disabled={manager.busy} />
              <NativeAction
                title={draft.routeId ? 'تطبيق التعديلات ونشر الخط' : 'موافقة ونشر'}
                prominent
                disabled={manager.busy}
                onPress={() => void decide(false)}
              />
            </>
          ) : null}
          {canReject ? (
            <NativeAction
              title="رفض المسودة"
              destructive
              disabled={manager.busy}
              onPress={() => {
                setReason('');
                setRejecting(true);
              }}
            />
          ) : null}
          {!canApprove && !canReject ? <Label secondary>لا تملك صلاحية اتخاذ قرار في هذه المحافظة.</Label> : null}
        </>
      ) : null}
      {manager.can('transit.edit_routes', [draft.cityId]) ? (
        <NativeAction
          title="تعديل الرسم في الاستوديو"
          disabled={manager.busy}
          onPress={() => navigation.open('transit_studio', { city: draft.cityId, edit: String(draft.id), editKind: 'draft' })}
        />
      ) : null}
      <AdminSheet
        title="رفض المسار"
        visible={rejecting && canReject && draft.status === 'pending'}
        busy={manager.busy}
        onClose={() => setRejecting(false)}
      >
        <Label>سبب الرفض سيظهر للمساهم. رفض تعديل مرتبط يعيد الخط المنشور السابق.</Label>
        <FormField
          label="سبب الرفض"
          value={reason}
          onChange={setReason}
          multiline
          maxLength={1000}
          disabled={manager.busy}
          {...(manager.fields.reason?.[0] ? { error: manager.fields.reason[0] } : {})}
        />
        <Messages manager={manager} />
        <NativeAction title="تأكيد الرفض" destructive disabled={manager.busy} onPress={() => void decide(true)} />
      </AdminSheet>
    </Section>
  );
}

export function RouteTools({
  route,
  cities,
  manager,
  editor,
  onChanged
}: {
  route: PublishedRoute;
  cities: readonly City[];
  manager: TransitManager;
  editor: RouteEditor;
  onChanged(): void;
}): React.JSX.Element {
  const navigation = useFeatureNavigation(),
    { panel, targetCity, splitAt, form, names } = editor.state;
  const setPanel = (value: RouteEditor['state']['panel']) => editor.update({ panel: value });
  const setTargetCity = (value: string) => editor.update({ targetCity: value });
  const setSplitAt = (value: string) => editor.update({ splitAt: value });
  const setForm = (value: RouteForm) => editor.update({ form: value });
  const setNames = (value: [string, string, string, string]) => editor.update({ names: value });
  const canEdit = manager.can('transit.edit_routes', [route.cityId]),
    canDelete = manager.can('transit.delete_routes', [route.cityId]);
  const stops = useResource(
    useCallback((signal) => client.stops(route.id, manager.account.sessionGeneration, signal), [route.id, manager.account.sessionGeneration]),
    { enabled: panel === 'split' && manager.can('transit.review_drafts', [route.cityId]) }
  );
  const perform = async (permission: string, affectedCities: readonly string[], task: (generation: number) => Promise<void>, message: string) => {
    const success = await manager.perform(permission, affectedCities, async (generation) => {
      await task(generation);
      return message;
    });
    if (success) {
      setPanel(null);
      onChanged();
    }
  };
  const update = (patch: Partial<RouteForm>) => setForm({ ...form, ...patch });
  const editable = panel !== 'delete' && canEdit,
    visible = panel !== null && (panel === 'delete' ? canDelete : canEdit);
  return (
    <Section>
      <Heading>{route.name}</Heading>
      {route.nameEn ? <Label secondary>{route.nameEn}</Label> : null}
      <Label>
        {route.city ?? route.cityId}، {ROUTE_LABELS[route.status]}
      </Label>
      <Label>
        {route.stopsCount} موقف، التعرفة {route.price == null ? 'غير محددة' : `${route.price} ل.س`}
        {route.oldPrice != null ? `، السابقة ${route.oldPrice} ل.س` : ''}
      </Label>
      <NativeAction title="عرض الخط في خريطة النقل" onPress={() => navigation.open('transit', { cityId: route.cityId, routeId: route.id })} />
      {canEdit ? (
        <>
          <ColorPicker
            value={route.color}
            disabled={manager.busy}
            onChange={(color) =>
              void perform(
                'transit.edit_routes',
                [route.cityId],
                (generation) => client.update(route.id, { color_index: color }, generation),
                'تم تحديث لون الخط.'
              )
            }
          />
          <NativeAction
            title="تعديل الاسم واللون والتعرفة"
            disabled={manager.busy}
            onPress={() => {
              setForm({ nameAr: route.name, nameEn: route.nameEn ?? '', price: route.price == null ? '' : String(route.price), color: route.color });
              setPanel('edit');
            }}
          />
          <NativeAction
            title="تعديل الرسم في الاستوديو"
            disabled={manager.busy}
            onPress={() => navigation.open('transit_studio', { city: route.cityId, edit: route.id, editKind: 'route' })}
          />
          <NativeAction
            title={route.status === 'published' ? 'تعطيل الخط' : 'تفعيل الخط'}
            disabled={manager.busy}
            onPress={() =>
              void perform(
                'transit.edit_routes',
                [route.cityId],
                (generation) => client.status(route.id, route.status === 'published' ? 'disapproved' : 'published', generation),
                'تم تحديث حالة الخط.'
              )
            }
          />
          {route.status !== 'hidden' ? (
            <NativeAction
              title="إخفاء الخط"
              disabled={manager.busy}
              onPress={() =>
                void perform('transit.edit_routes', [route.cityId], (generation) => client.status(route.id, 'hidden', generation), 'تم إخفاء الخط.')
              }
            />
          ) : null}
          <NativeAction
            title="نقل الخط لمدينة أخرى"
            disabled={manager.busy}
            onPress={() => {
              setTargetCity(route.cityId);
              setPanel('move');
            }}
          />
          {manager.can('transit.review_drafts', [route.cityId]) ? (
            <NativeAction title="تقسيم الخط عند محطة" disabled={manager.busy} onPress={() => setPanel('split')} />
          ) : null}
        </>
      ) : null}
      {canDelete ? <NativeAction title="حذف الخط" destructive disabled={manager.busy} onPress={() => setPanel('delete')} /> : null}
      <AdminSheet
        title={panel === 'edit' ? 'تعديل الخط' : panel === 'move' ? 'نقل الخط' : panel === 'split' ? 'تقسيم الخط' : 'حذف الخط'}
        visible={visible}
        busy={manager.busy}
        onClose={() => setPanel(null)}
      >
        {panel === 'edit' && editable ? (
          <>
            <RouteFields form={form} update={update} manager={manager} />
            <NativeAction
              title="حفظ بيانات الخط"
              prominent
              disabled={manager.busy}
              onPress={() =>
                void perform(
                  'transit.edit_routes',
                  [route.cityId],
                  (generation) => client.update(route.id, routePayload(form), generation),
                  'تم تحديث الخط.'
                )
              }
            />
          </>
        ) : null}
        {panel === 'move' && editable ? (
          <>
            <Label>سيُنقل «{route.name}» والمواقف غير المشتركة مع خطوط أخرى.</Label>
            <CityPicker cities={cities} value={targetCity} onChange={setTargetCity} disabled={manager.busy} />
            <NativeAction
              title="تأكيد النقل"
              disabled={manager.busy || targetCity === route.cityId || !targetCity || !manager.can('transit.edit_routes', [route.cityId, targetCity])}
              onPress={() =>
                void perform(
                  'transit.edit_routes',
                  [route.cityId, targetCity],
                  (generation) => client.move(route.id, targetCity, generation),
                  'تم نقل الخط.'
                )
              }
            />
          </>
        ) : null}
        {panel === 'split' && editable ? (
          <>
            <Label>سيُعطل الخط الأصلي وتُنشأ نسختان عند محطة داخلية مشتركة بين القسمين.</Label>
            <RequestStatus resource={stops} />
            {stops.data ? (
              <>
                <NativePicker
                  label="محطة التقسيم"
                  value={splitAt}
                  onChange={setSplitAt}
                  disabled={manager.busy}
                  options={[
                    { value: '', label: 'اختر محطة داخلية' },
                    ...stops.data.slice(1, -1).map((stop) => ({ value: stop.id, label: stop.name }))
                  ]}
                />
                {stops.data.length < 3 ? <Label>يلزم وجود ثلاث محطات على الأقل لتقسيم الخط.</Label> : null}
              </>
            ) : null}
            {(['اسم القسم الأول بالعربية', 'اسم القسم الأول بالإنجليزية', 'اسم القسم الثاني بالعربية', 'اسم القسم الثاني بالإنجليزية'] as const).map(
              (label, index) => (
                <FormField
                  key={label}
                  label={label}
                  value={names[index] ?? ''}
                  onChange={(value) =>
                    setNames(names.map((name, position) => (position === index ? value : name)) as [string, string, string, string])
                  }
                  maxLength={255}
                  disabled={manager.busy}
                />
              )
            )}
            <NativeAction
              title="تأكيد التقسيم"
              disabled={manager.busy || !splitAt || !stops.data}
              onPress={() =>
                void perform(
                  'transit.edit_routes',
                  [route.cityId],
                  (generation) => client.split(splitPayload(route.id, stops.data ?? [], splitAt, names), generation),
                  'تم تقسيم الخط.'
                )
              }
            />
          </>
        ) : null}
        {panel === 'delete' && canDelete ? (
          <>
            <Label>سيُحذف «{route.name}» وهندسته وروابطه، وتُحذف المواقف التي لا تتبع أي خط آخر. لا يمكن التراجع.</Label>
            <NativeAction
              title="تأكيد حذف الخط"
              destructive
              disabled={manager.busy}
              onPress={() =>
                void perform('transit.delete_routes', [route.cityId], (generation) => client.remove(route.id, generation), 'تم حذف الخط.')
              }
            />
          </>
        ) : null}
        <Messages manager={manager} />
      </AdminSheet>
    </Section>
  );
}
export function RouteFields({
  form,
  update,
  manager
}: {
  form: RouteForm;
  update(patch: Partial<RouteForm>): void;
  manager: TransitManager;
}): React.JSX.Element {
  return (
    <View style={{ gap: 12 }}>
      <FormField
        label="اسم الخط بالعربية"
        value={form.nameAr}
        onChange={(nameAr) => update({ nameAr })}
        maxLength={255}
        disabled={manager.busy}
        {...(manager.fields.name_ar?.[0] ? { error: manager.fields.name_ar[0] } : {})}
      />
      <FormField label="اسم الخط بالإنجليزية" value={form.nameEn} onChange={(nameEn) => update({ nameEn })} maxLength={255} disabled={manager.busy} />
      <FormField
        label="التعرفة بالليرة السورية، فارغ لإزالة التعرفة"
        value={form.price}
        onChange={(price) => update({ price })}
        keyboardType="number-pad"
        disabled={manager.busy}
      />
      <ColorPicker value={form.color} onChange={(color) => update({ color })} disabled={manager.busy} />
    </View>
  );
}
export function CombineSheet({
  visible,
  cities,
  routes,
  manager,
  onClose,
  onChanged
}: {
  visible: boolean;
  cities: readonly City[];
  routes: readonly PublishedRoute[];
  manager: TransitManager;
  onClose(): void;
  onChanged(): void;
}): React.JSX.Element {
  const [city, setCity] = useState(''),
    [a, setA] = useState(''),
    [b, setB] = useState(''),
    [name, setName] = useState(''),
    [english, setEnglish] = useState(''),
    [price, setPrice] = useState('');
  const choices = routes.filter((route) => route.cityId === city && route.status === 'published' && manager.can('transit.edit_routes', [city]));
  const first = choices.find((route) => route.id === a),
    second = choices.find((route) => route.id === b);
  return (
    <AdminSheet title="دمج خطوط النقل" visible={visible && manager.can('transit.edit_routes')} busy={manager.busy} onClose={onClose}>
      <Label>اختر خطين في المدينة نفسها. سيُنشأ خط جديد ويُعطل الخطان الأصليان.</Label>
      <CityPicker
        cities={cities}
        value={city}
        onChange={(value) => {
          setCity(value);
          setA('');
          setB('');
        }}
        disabled={manager.busy}
      />
      <NativePicker
        label="الخط الأول"
        value={a}
        onChange={setA}
        disabled={manager.busy}
        options={[
          { value: '', label: 'اختر الخط الأول' },
          ...choices.filter((route) => route.id !== b).map((route) => ({ value: route.id, label: route.name }))
        ]}
      />
      <NativePicker
        label="الخط الثاني"
        value={b}
        onChange={setB}
        disabled={manager.busy}
        options={[
          { value: '', label: 'اختر الخط الثاني' },
          ...choices.filter((route) => route.id !== a).map((route) => ({ value: route.id, label: route.name }))
        ]}
      />
      <FormField label="اسم الخط المدموج بالعربية" value={name} onChange={setName} maxLength={255} disabled={manager.busy} />
      <FormField label="اسم الخط المدموج بالإنجليزية" value={english} onChange={setEnglish} maxLength={255} disabled={manager.busy} />
      <FormField
        label="التعرفة الجديدة، فارغ للحفاظ على الأصلية"
        value={price}
        onChange={setPrice}
        keyboardType="number-pad"
        disabled={manager.busy}
      />
      <Messages manager={manager} />
      <NativeAction
        title="تأكيد الدمج"
        prominent
        disabled={manager.busy || !first || !second || !name.trim()}
        onPress={() => {
          if (!first || !second) return;
          void manager
            .perform('transit.edit_routes', [first.cityId, second.cityId], async (generation) => {
              await client.combine(combinePayload(first, second, name, english, price), generation);
              return 'تم دمج الخطين.';
            })
            .then((success) => {
              if (success && api.getSessionGeneration() === manager.account.sessionGeneration) {
                onClose();
                onChanged();
              }
            });
        }}
      />
    </AdminSheet>
  );
}
// PORT STATUS: source Transit/admin/Index.tsx moderation and route dialogs; confidence medium; todos 1 spatial and controlled-account verification.
