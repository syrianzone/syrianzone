import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Alert, FlatList, TextInput, View } from 'react-native';
import { api, ApiError } from '../../api';
import { contentStyle, EmptyState, FormField, Heading, Label, Photo, RequestStatus, SearchField, Section } from '../../components';
import { matchesSearch } from '../../domain';
import { useAccount } from '../account';
import type { FeatureScreenProps } from '../features';
import { EditorSheet } from '../Sheet';
import { imageFormData, pickImage, type ImageUploadAsset } from '../uploads';
import { useResource } from '../../resource';
import { NativeAction, NativeIconAction, NativePicker, NativeSegmented, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { createDirectoryAdminClient } from './admin-api';
import { adminPermission, appendAdminFields, fieldErrors, formPayload, orderedMove, type AdminDefinition, type AdminField, type AdminKind, type AdminRow, type AdminValues } from './admin-contract';

interface Editor { kind: AdminKind; row: AdminRow | null }
type Run = (action: () => Promise<void>) => Promise<boolean>;
const imageBounds = { maxBytes: 5 * 1024 * 1024 };
function confirmDelete(title: string, detail: string, action: () => void): void { Alert.alert(title, detail, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: action }]); }

// PORT NOTE: four website editors share category, record and permission mechanics. Their field and response contracts remain separate definitions.
export function DirectoryAdminScreen({ definition, params }: FeatureScreenProps & { definition: AdminDefinition }): React.JSX.Element {
  const account = useAccount();
  const permissions = account.user?.effective_permissions ?? [];
  const allowed = ['create', 'edit', 'delete', 'reorder', 'toggle'].some(action => permissions.includes(adminPermission(definition, action as 'create')));
  if (!account.ready) return <EmptyState title="جارٍ قراءة صلاحيات الحساب" />;
  if (!allowed) return <EmptyState title="لا تملك صلاحية إدارة هذا الدليل" />;
  return <DirectoryBody key={`${account.sessionGeneration}:${permissions.join(',')}`} definition={definition} params={params} />;
}
function DirectoryBody({ definition, params }: FeatureScreenProps & { definition: AdminDefinition }): React.JSX.Element {
  const account = useAccount(), { colors } = useTheme(), generation = account.sessionGeneration;
  const permissions = account.user?.effective_permissions ?? [], can = (action: 'create' | 'edit' | 'delete' | 'reorder' | 'toggle') => permissions.includes(adminPermission(definition, action));
  const resource = useResource(useCallback(signal => createDirectoryAdminClient(definition, generation).page(signal), [definition, generation]));
  const [kind, setKind] = useState<AdminKind>(params.view === 'categories' && definition.categories ? 'categories' : 'items');
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Readonly<Record<string, readonly string[]>>>({});
  const working = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const all = kind === 'categories' ? resource.data?.categories ?? [] : resource.data?.items ?? [];
  const rows = all.filter(row => (!category || kind === 'categories' || row.categoryId === category) && matchesSearch(Object.values(row.values).join(' '), query));
  const run: Run = async action => {
    if (working.current || !alive.current || generation !== api.getSessionGeneration()) return false;
    working.current = true; setBusy(true); setError(null); setFields({}); setMessage(null);
    try {
      await action();
      if (!alive.current || generation !== api.getSessionGeneration()) return false;
      setMessage('أكد الخادم حفظ التغيير.'); resource.reload(); return true;
    } catch (reason) {
      if (alive.current && generation === api.getSessionGeneration()) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ التغيير.'); if (reason instanceof ApiError) setFields(reason.fields); }
      return false;
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  const edit = (row: AdminRow | null) => { setFields({}); setError(null); setEditor({ kind, row }); };
  const remove = (row: AdminRow) => confirmDelete(`حذف «${row.title}»؟`, kind === 'categories' ? definition.key === 'guesswho' ? 'تُحذف الفئة وكل شخصياتها وألعابها. لا يمكن التراجع عن الحذف.' : 'تُحذف الفئة وكل سجلاتها. لا يمكن التراجع عن الحذف.' : 'لا يمكن التراجع عن الحذف.', () => { void run(() => createDirectoryAdminClient(definition, generation).remove(kind, row.id)); });
  const reorder = (index: number, delta: -1 | 1) => { void run(() => createDirectoryAdminClient(definition, generation).reorder(kind, orderedMove(all.map(row => row.id), index, delta))); };
  return <><FlatList data={rows} keyExtractor={row => row.id} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload} initialNumToRender={8}
    ListHeaderComponent={<View style={{ gap: 14 }}><Heading>{definition.title}</Heading><RequestStatus resource={resource} />
      {definition.categories ? <NativeSegmented value={kind} onChange={value => { setKind(value); setCategory(''); }} disabled={busy} options={[{ value: 'items', label: definition.key === 'guesswho' ? 'الشخصيات' : 'السجلات' }, { value: 'categories', label: 'الفئات' }]} /> : null}
      <SearchField value={query} onChange={setQuery} placeholder="ابحث في الاسم أو المعرّف" />{kind === 'items' && definition.categories ? <NativePicker label="الفئة" value={category} onChange={setCategory} disabled={busy} options={[{ value: '', label: 'كل الفئات' }, ...(resource.data?.categories ?? []).map(row => ({ value: row.id, label: row.title }))]} /> : null}
      {resource.data ? <Label secondary>{rows.length} من {all.length} سجل</Label> : null}{can('create') ? <NativeAction title={kind === 'categories' ? 'إضافة فئة' : 'إضافة سجل'} systemImage="plus" prominent disabled={busy || !resource.data} onPress={() => edit(null)} /> : null}
      {definition.reorder && can('reorder') && (query || category) ? <Label secondary>امسح البحث والتصفية لتغيير ترتيب السجلات.</Label> : null}
      {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}{message ? <Label style={{ color: colors.success }}>{message}</Label> : null}</View>}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد سجلات مطابقة" /> : undefined}
    renderItem={({ item, index }) => <Section>{item.image ? <Photo url={item.image} label={item.title} height={130} /> : null}<Heading>{item.title}</Heading><Label secondary>{item.id}، {item.active ? 'مفعّل' : 'مخفي'}{item.categoryId ? `، ${resource.data?.categories.find(row => row.id === item.categoryId)?.title ?? item.categoryId}` : ''}</Label>
      {definition.key === 'guesswho' && kind === 'categories' && typeof item.original.characters_count === 'number' ? <Label secondary>{item.original.characters_count} شخصية</Label> : null}
      {can('edit') ? <NativeAction title="تعديل" disabled={busy} onPress={() => edit(item)} /> : null}
      {kind === 'items' && definition.toggle && can('toggle') ? <NativeToggle title="ظاهر في الدليل" value={item.active} disabled={busy} onChange={() => { void run(() => createDirectoryAdminClient(definition, generation).toggle(item.id)); }} /> : null}
      {can('delete') ? <NativeAction title="حذف" destructive disabled={busy} onPress={() => remove(item)} /> : null}
      {definition.reorder && can('reorder') && !query && !category ? <View style={{ flexDirection: 'row', gap: 12 }}><NativeIconAction title={`تقديم ${item.title}`} systemImage="arrow.up" disabled={busy || index === 0} onPress={() => reorder(index, -1)} /><NativeIconAction title={`تأخير ${item.title}`} systemImage="arrow.down" disabled={busy || index === all.length - 1} onPress={() => reorder(index, 1)} /></View> : null}
    </Section>} />
    {editor && resource.data ? <DirectoryEditor key={`${editor.kind}:${editor.row?.id ?? 'new'}`} definition={definition} editor={editor} categories={resource.data.categories} busy={busy} error={error} serverFields={fields} run={run} close={() => { if (!busy) setEditor(null); }} generation={generation} /> : null}
  </>;
}
function DirectoryEditor({ definition, editor, categories, busy, error, serverFields, run, close, generation }: {
  definition: AdminDefinition; editor: Editor; categories: AdminRow[]; busy: boolean; error: string | null; serverFields: Readonly<Record<string, readonly string[]>>; run: Run; close(): void; generation: number;
}): React.JSX.Element {
  const { colors } = useTheme(), creating = editor.row === null;
  const base = editor.kind === 'categories' ? definition.categoryFields : definition.itemFields;
  const extra: AdminField[] = Object.keys(editor.row?.values ?? {}).filter(key => key.includes('.') && !base.some(field => field.key === key)).map(key => ({ key, label: `رابط إضافي: ${key.split('.')[1]}`, kind: 'url', max: 2048 }));
  const fields = [...base, ...extra];
  const initial: AdminValues = editor.row?.values ?? Object.fromEntries(fields.map(field => [field.key, field.kind === 'toggle' ? field.key !== 'is_whatsapp' : field.kind === 'category' ? categories[0]?.id ?? '' : '']));
  const [values, setValues] = useState<AdminValues>(initial), [image, setImage] = useState<ImageUploadAsset | null>(null), [picking, setPicking] = useState(false), [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const alive = useRef(true), inputs = useRef(new Map<string, ComponentRef<typeof TextInput>>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const errors = { ...Object.fromEntries(Object.entries(serverFields).map(([key, messages]) => [key, messages[0] ?? 'تحقق من القيمة.'])), ...localErrors };
  const focusError = (issues: Record<string, string>) => { const first = Object.entries(issues)[0]; if (first) { inputs.current.get(first[0])?.focus(); AccessibilityInfo.announceForAccessibility(first[1]); } };
  useEffect(() => { const first = Object.entries(serverFields)[0]; if (first) { inputs.current.get(first[0])?.focus(); AccessibilityInfo.announceForAccessibility(first[1][0] ?? 'تحقق من الحقول.'); } }, [serverFields]);
  const set = (key: string, value: string | boolean) => { setValues(previous => ({ ...previous, [key]: value })); setLocalErrors(previous => { const next = { ...previous }; delete next[key]; return next; }); };
  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || image !== null;
  const dismiss = () => { if (busy || picking) return; if (dirty) Alert.alert('تجاهل التعديلات؟', 'لن تُحفظ التغييرات غير المرسلة.', [{ text: 'متابعة التحرير', style: 'cancel' }, { text: 'تجاهل', style: 'destructive', onPress: close }]); else close(); };
  const chooseImage = async () => { if (busy || picking) return; setPicking(true); try { const asset = await pickImage(imageBounds); if (alive.current && generation === api.getSessionGeneration() && asset) setImage(asset); } catch (reason) { if (alive.current) setLocalErrors(previous => ({ ...previous, [definition.image?.field ?? 'image_file']: reason instanceof Error ? reason.message : 'تعذر اختيار الصورة.' })); } finally { if (alive.current) setPicking(false); } };
  const save = () => {
    const issues = fieldErrors(fields, values, creating);
    if (editor.kind === 'items' && definition.image?.required && creating && !image) issues[definition.image.field] = 'اختر صورة للشخصية.';
    if (Object.keys(issues).length) { setLocalErrors(issues); focusError(issues); return; }
    const payload = formPayload(fields, values, creating, editor.row?.original);
    void run(async () => {
      let body: unknown = payload;
      if (image && definition.image && editor.kind === 'items') {
        const form = imageFormData(definition.image.field, image, imageBounds);
        appendAdminFields(form, payload);
        body = form;
      }
      await createDirectoryAdminClient(definition, generation).save(editor.kind, editor.row?.id ?? null, body);
    }).then(saved => { if (saved && alive.current) close(); });
  };
  return <EditorSheet title={creating ? editor.kind === 'categories' ? 'إضافة فئة' : 'إضافة سجل' : `تعديل ${editor.row!.title}`} visible close={dismiss}>
    {fields.map(field => field.immutable && !creating ? <Label key={field.key} secondary>{field.label}: {values[field.key]}</Label> : field.kind === 'toggle' ? <NativeToggle key={field.key} title={field.label} value={Boolean(values[field.key])} disabled={busy || picking} onChange={value => set(field.key, value)} /> : field.kind === 'category' ? <View key={field.key}><NativePicker label={field.label} value={String(values[field.key] ?? '')} options={categories.map(row => ({ value: row.id, label: row.title }))} disabled={busy || picking} onChange={value => set(field.key, value)} />{errors[field.key] ? <Label style={{ color: colors.danger }}>{errors[field.key]}</Label> : null}</View> : <FormField key={field.key} label={field.label} value={String(values[field.key] ?? '')} onChange={value => set(field.key, value)} disabled={busy || picking} multiline={field.kind === 'multiline' || field.kind === 'attributes'} keyboardType={field.kind === 'url' ? 'url' : 'default'} {...(field.max ? { maxLength: field.max } : {})} {...(errors[field.key] ? { error: errors[field.key] } : {})} inputRef={input => { if (input) inputs.current.set(field.key, input); else inputs.current.delete(field.key); }} />)}
    {editor.kind === 'items' && definition.image ? <Section>{image?.uri || editor.row?.image ? <Photo url={image?.uri ?? editor.row?.image ?? null} label="الصورة المختارة" height={190} /> : null}<NativeAction title={picking ? 'جارٍ اختيار الصورة' : 'اختيار صورة'} systemImage="photo.badge.plus" disabled={busy || picking} onPress={() => { void chooseImage(); }} />{image ? <NativeAction title="إلغاء تغيير الصورة" disabled={busy || picking} onPress={() => setImage(null)} /> : null}{errors[definition.image.field] ? <Label style={{ color: colors.danger }}>{errors[definition.image.field]}</Label> : null}<Label secondary>JPG أو PNG أو WebP، حتى خمسة ميغابايت.</Label></Section> : null}
    {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}<NativeAction title={busy ? 'جارٍ الحفظ' : 'حفظ'} prominent disabled={busy || picking || !creating && !dirty} onPress={save} />
  </EditorSheet>;
}
// PORT STATUS: source Admin/{Phonebook,GovApps,SyOfficial,GuessWho} editors and Components/directory/CategoryDialog.tsx; confidence medium; todos 1 authenticated native interaction, image and accessibility verification with isolated data.
