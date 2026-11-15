import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Image } from 'expo-image';
import { EditorSheet } from '../../platform/Sheet';
export { EditorSheet } from '../../platform/Sheet';
import { api } from '../../api';
import { FormField, Heading, Label, RequestStatus, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation } from '../../platform/features';
import { pickImage } from '../../platform/uploads';
import { assetUrl } from '../../platform/validation';
import { useResource } from '../../resource';
import { NativeAction, NativeDatePicker, NativePicker, NativeSegmented, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { candidateImageBounds, pollAdminApi } from './api';
import { corePollSlug, eligibleSuccessors, pollFormErrors, type ManagedCandidate } from './model';

function confirm(title: string, description: string, run: () => void, destructive = false): void {
  Alert.alert(title, description, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'تأكيد', ...(destructive ? { style: 'destructive' as const } : {}), onPress: run },
  ]);
}
const localDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function PollEditor({
  pollId,
  onChanged,
  onClose,
}: {
  pollId: string;
  onChanged(): void;
  onClose(): void;
}): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    { colors } = useTheme(),
    stamp = account.sessionGeneration;
  const actions = pollAdminApi(stamp),
    permissions = account.user?.effective_permissions ?? [],
    canCreate = permissions.includes('polls.create'),
    canEdit = permissions.includes('polls.edit'),
    canDelete = permissions.includes('polls.delete'),
    canUpload = permissions.includes('assets.manage');
  const details = useResource(
    useCallback((signal) => pollAdminApi(stamp).details(pollId, signal), [pollId, stamp]),
  );
  const [title, setTitle] = useState(''),
    [slug, setSlug] = useState(''),
    [active, setActive] = useState(true),
    dirty = useRef(false);
  const [group, setGroup] = useState('all'),
    [newGroup, setNewGroup] = useState(''),
    [filter, setFilter] = useState('active'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    locked = useRef(false);
  const [candidate, setCandidate] = useState<ManagedCandidate | null>(null),
    [candidateOpen, setCandidateOpen] = useState(false),
    [name, setName] = useState(''),
    [candidateTitle, setCandidateTitle] = useState(''),
    [handle, setHandle] = useState(''),
    [image, setImage] = useState(''),
    [candidateGroup, setCandidateGroup] = useState('none');
  const [archive, setArchive] = useState<ManagedCandidate | null>(null),
    [archiveDate, setArchiveDate] = useState<string | null>(null),
    [reason, setReason] = useState(''),
    [successor, setSuccessor] = useState('none');
  useEffect(() => {
    if (details.data && !dirty.current) {
      setTitle(details.data.poll.title);
      setSlug(details.data.poll.slug);
      setActive(details.data.poll.active);
    }
  }, [details.data]);
  useEffect(() => {
    if (details.data && group !== 'all' && !details.data.groups.some((item) => item.id === group))
      setGroup('all');
  }, [details.data, group]);
  async function mutate(work: () => Promise<unknown>, refresh = true): Promise<boolean> {
    if (locked.current || account.busy) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      if (api.getSessionGeneration() !== stamp) return false;
      if (refresh) {
        details.reload();
        onChanged();
      }
      return true;
    } catch (failure) {
      if (api.getSessionGeneration() === stamp)
        setError(failure instanceof Error ? failure.message : 'تعذر حفظ التغيير.');
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function edit(item: ManagedCandidate | null): void {
    setCandidate(item);
    setName(item?.name ?? '');
    setCandidateTitle(item?.title ?? '');
    setHandle(item?.handle ?? '');
    setImage(item?.image ?? '');
    setCandidateGroup(item?.groupId ?? (group === 'all' ? 'none' : group));
    setError(null);
    setCandidateOpen(true);
  }
  async function saveCandidate(): Promise<void> {
    if (!name.trim()) {
      setError('اكتب اسم المرشح.');
      return;
    }
    let url: string | null;
    try {
      url = image.trim() ? assetUrl(image.trim()) : null;
    } catch {
      setError('أدخل رابط صورة HTTPS صالحاً.');
      return;
    }
    if (handle.trim() && !/^@?[A-Za-z0-9_]{1,15}$/.test(handle.trim())) {
      setError('معرف X يقبل حتى ١٥ حرفاً لاتينياً أو رقماً أو شرطة سفلية.');
      return;
    }
    const saved = await mutate(() =>
      actions.saveCandidate(candidate?.id ?? null, {
        ...(!candidate ? { poll_id: pollId } : {}),
        name: name.trim(),
        title: candidateTitle.trim() || null,
        x_handle: handle.trim() || null,
        image_url: url,
        candidate_group_id: candidateGroup === 'none' ? null : candidateGroup,
      }),
    );
    if (saved) setCandidateOpen(false);
  }
  const data = details.data,
    selectedGroup = data?.groups.find((item) => item.id === group),
    disabled = busy || details.loading || account.busy;
  let preview: string | null = null;
  try {
    if (image.trim()) preview = assetUrl(image.trim());
  } catch {
    /* Incomplete text is validated when the user saves. */
  }
  const visible =
    data?.candidates.filter(
      (item) => (group === 'all' || item.groupId === group) && (filter === 'all' || item.status === filter),
    ) ?? [];
  function publicPage(view: string): void {
    if (data) navigation.open('tierlist', { view, poll: data.poll.slug });
  }
  return (
    <Section>
      <Heading subtitle="تدار المجموعات والمرشحون من هذا المحرر">تحرير الاستبيان</Heading>
      <NativeAction title="إغلاق المحرر" disabled={busy} onPress={onClose} />
      <RequestStatus resource={details} />
      {data ? (
        <>
          <NativeAction title="عرض صفحة التصويت" onPress={() => publicPage('board')} />
          <NativeAction title="عرض النتائج" onPress={() => publicPage('leaderboard')} />
          {canEdit ? (
            <>
              <FormField
                disabled={busy}
                label="العنوان"
                value={title}
                autoCorrect={false}
                maxLength={200}
                onChange={(value) => {
                  dirty.current = true;
                  setTitle(value);
                }}
              />
              {data.poll.slug === corePollSlug ? (
                <Label secondary>المعرف: {slug}، لا يمكن إعادة تسمية الاستبيان الأساسي.</Label>
              ) : (
                <FormField
                  disabled={busy}
                  label="المعرف (Slug)"
                  value={slug}
                  keyboardType="url"
                  maxLength={100}
                  onChange={(value) => {
                    dirty.current = true;
                    setSlug(value);
                  }}
                />
              )}
              <NativeToggle
                disabled={busy}
                title="التصويت نشط"
                value={active}
                onChange={(value) => {
                  dirty.current = true;
                  setActive(value);
                }}
              />
              <NativeAction
                title="حفظ إعدادات الاستبيان"
                disabled={disabled}
                onPress={() => {
                  const errors = pollFormErrors(title, slug, data.poll.slug);
                  if (Object.keys(errors).length) {
                    setError(Object.values(errors).join(' '));
                    return;
                  }
                  void mutate(async () => {
                    await actions.update(data.poll.id, {
                      title: title.trim(),
                      slug: slug.trim(),
                      is_active: active,
                    });
                    dirty.current = false;
                  });
                }}
              />
            </>
          ) : (
            <>
              <Label>{data.poll.title}</Label>
              <Label secondary>
                {data.poll.slug}، {data.poll.active ? 'نشط' : 'معطل'}
              </Label>
            </>
          )}
          <NativePicker
            label="المجموعة"
            value={group}
            options={[
              { value: 'all', label: 'الكل' },
              ...data.groups.map((item) => ({
                value: item.id,
                label: `${item.name}${item.isDefault ? ' ★' : ''}${item.active ? '' : ' (معطلة)'}`,
              })),
            ]}
            onChange={setGroup}
            disabled={disabled}
          />
          {canCreate ? (
            <>
              <FormField
                disabled={busy}
                label="اسم مجموعة جديدة"
                value={newGroup}
                autoCorrect={false}
                maxLength={255}
                onChange={setNewGroup}
              />
              <NativeAction
                title="إضافة مجموعة"
                disabled={disabled || !newGroup.trim()}
                onPress={() => {
                  void mutate(() =>
                    actions.createGroup({ poll_id: data.poll.id, name: newGroup.trim() }),
                  ).then((saved) => {
                    if (saved) setNewGroup('');
                  });
                }}
              />
            </>
          ) : null}
          {selectedGroup ? (
            <Section style={{ backgroundColor: colors.elevated }}>
              <Label>
                {selectedGroup.name}
                {selectedGroup.active ? '' : '، معطلة'}
              </Label>
              {!selectedGroup.active ? (
                <Label secondary>
                  البيانات والمرشحون والصور والنتائج محفوظة، لكن المجموعة مخفية عن التصويت والترتيب حتى تعيد
                  تفعيلها.
                </Label>
              ) : null}
              {canEdit ? (
                <>
                  <NativeAction
                    title={selectedGroup.isDefault ? 'المجموعة الافتراضية' : 'تعيين كافتراضية'}
                    disabled={disabled || selectedGroup.isDefault || !selectedGroup.active}
                    onPress={() => {
                      void mutate(() => actions.defaultGroup(selectedGroup.id));
                    }}
                  />
                  <NativeAction
                    title="نقل المجموعة لليمين"
                    disabled={disabled || data.groups[0]?.id === selectedGroup.id}
                    onPress={() => {
                      const index = data.groups.findIndex((item) => item.id === selectedGroup.id),
                        order = data.groups.slice();
                      const prior = order[index - 1];
                      if (prior) {
                        order[index - 1] = selectedGroup;
                        order[index] = prior;
                        void mutate(() =>
                          actions.reorderGroups(
                            order.map((item, position) => ({ id: item.id, sort_order: position })),
                          ),
                        );
                      }
                    }}
                  />
                  <NativeAction
                    title="نقل المجموعة لليسار"
                    disabled={disabled || data.groups.at(-1)?.id === selectedGroup.id}
                    onPress={() => {
                      const index = data.groups.findIndex((item) => item.id === selectedGroup.id),
                        order = data.groups.slice();
                      const next = order[index + 1];
                      if (next) {
                        order[index + 1] = selectedGroup;
                        order[index] = next;
                        void mutate(() =>
                          actions.reorderGroups(
                            order.map((item, position) => ({ id: item.id, sort_order: position })),
                          ),
                        );
                      }
                    }}
                  />
                  <NativeAction
                    title={selectedGroup.active ? 'تعطيل المجموعة' : 'إعادة تفعيل المجموعة'}
                    disabled={disabled}
                    onPress={() => {
                      const run = (): void => {
                        void mutate(() => actions.activeGroup(selectedGroup.id, !selectedGroup.active));
                      };
                      if (selectedGroup.active)
                        confirm(
                          'تعطيل المجموعة؟',
                          'تبقى البيانات محفوظة، وتختفي المجموعة من صفحات التصويت والترتيب حتى تعيد تفعيلها.',
                          run,
                        );
                      else run();
                    }}
                  />
                </>
              ) : null}
              {canDelete ? (
                <NativeAction
                  title="حذف المجموعة"
                  destructive
                  disabled={disabled}
                  onPress={() =>
                    confirm(
                      'حذف هذه المجموعة؟',
                      'سيتم إلغاء تعيين مرشحيها.',
                      () => {
                        void mutate(() => actions.deleteGroup(selectedGroup.id));
                      },
                      true,
                    )
                  }
                />
              ) : null}
            </Section>
          ) : null}
          <NativeSegmented
            value={filter}
            options={[
              { value: 'active', label: 'الحاليون' },
              { value: 'archived', label: 'السابقون' },
              { value: 'all', label: 'الكل' },
            ]}
            onChange={setFilter}
            disabled={disabled}
          />
          {canCreate ? (
            <NativeAction title="إضافة مرشح" prominent disabled={disabled} onPress={() => edit(null)} />
          ) : null}
          {!visible.length ? <Label secondary>لا يوجد مرشحون في هذا التصنيف.</Label> : null}
          {visible.map((item) => (
            <Section key={item.id} style={{ backgroundColor: colors.elevated }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    accessibilityLabel={item.name}
                    style={{ height: 52, width: 52, borderRadius: 26 }}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Label style={{ fontWeight: '700' }}>{item.name}</Label>
                  {item.title ? <Label secondary>{item.title}</Label> : null}
                </View>
              </View>
              <Label secondary>
                {data.groups.find((row) => row.id === item.groupId)?.name ?? 'دون مجموعة'}
                {item.status === 'archived' ? '، سابق' : ''}
                {data.groups.find((row) => row.id === item.groupId)?.active === false ? '، مجموعة معطلة' : ''}
              </Label>
              {item.status === 'archived' ? (
                <>
                  {item.termEnd ? <Label secondary>حتى {item.termEnd.slice(0, 10)}</Label> : null}
                  {item.reason ? <Label secondary>السبب: {item.reason}</Label> : null}
                  {item.successorId ? (
                    <Label secondary>
                      خلفه: {data.candidates.find((row) => row.id === item.successorId)?.name ?? ''}
                    </Label>
                  ) : null}
                </>
              ) : null}
              {canEdit ? (
                <>
                  <NativeAction title="تعديل المرشح" disabled={disabled} onPress={() => edit(item)} />
                  <NativeAction
                    title={item.status === 'archived' ? 'إعادة تفعيل المرشح' : 'أرشفة المرشح'}
                    disabled={disabled}
                    onPress={() => {
                      if (item.status === 'archived')
                        confirm(`إعادة تفعيل ${item.name}؟`, '', () => {
                          void mutate(() => actions.restoreCandidate(item.id));
                        });
                      else {
                        setArchive(item);
                        setArchiveDate(new Date().toISOString().slice(0, 10));
                        setReason('');
                        setSuccessor('none');
                        setError(null);
                      }
                    }}
                  />
                </>
              ) : null}
              {canDelete ? (
                <NativeAction
                  title="حذف المرشح"
                  destructive
                  disabled={disabled}
                  onPress={() =>
                    confirm(
                      'حذف هذا المرشح؟',
                      'لا يمكن التراجع عن الحذف.',
                      () => {
                        void mutate(() => actions.deleteCandidate(item.id));
                      },
                      true,
                    )
                  }
                />
              ) : null}
            </Section>
          ))}
        </>
      ) : null}
      {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
      <EditorSheet
        title={candidate ? 'تعديل المرشح' : 'إضافة مرشح'}
        visible={candidateOpen}
        close={() => {
          if (!busy) setCandidateOpen(false);
        }}
      >
        <FormField disabled={busy} label="الاسم" value={name} maxLength={255} autoCorrect={false} onChange={setName} />
        <FormField
          disabled={busy}
          label="الصفة"
          value={candidateTitle}
          autoCorrect={false}
          maxLength={255}
          onChange={setCandidateTitle}
        />
        <FormField disabled={busy} label="معرف X" value={handle} maxLength={16} onChange={setHandle} />
        {preview ? (
          <Image
            source={{ uri: preview }}
            accessibilityLabel="معاينة الصورة"
            contentFit="contain"
            style={{ height: 150 }}
          />
        ) : null}
        {canUpload ? (
          <NativeAction
            title="اختيار صورة ورفعها"
            systemImage="photo"
            disabled={busy}
            onPress={() => {
              void mutate(async () => {
                const asset = await pickImage(candidateImageBounds);
                if (asset) {
                  const url = await actions.upload(asset);
                  if (api.getSessionGeneration() === stamp) setImage(url);
                }
              }, false);
            }}
          />
        ) : null}
        <FormField
          disabled={busy}
          label="رابط صورة مباشر (HTTPS)"
          value={image}
          onChange={setImage}
          keyboardType="url"
        />
        <NativeAction title="مسح الصورة" disabled={busy || !image} onPress={() => setImage('')} />
        <NativePicker
          label="مجموعة المرشح"
          value={candidateGroup}
          options={[
            { value: 'none', label: 'دون مجموعة' },
            ...(data?.groups ?? []).map((item) => ({
              value: item.id,
              label: `${item.name}${item.active ? '' : ' (معطلة)'}`,
            })),
          ]}
          onChange={setCandidateGroup}
          disabled={busy}
        />
        {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        <NativeAction
          title="حفظ المرشح"
          prominent
          disabled={busy || (candidate ? !canEdit : !canCreate)}
          onPress={() => {
            void saveCandidate();
          }}
        />
      </EditorSheet>
      <EditorSheet
        title={`أرشفة ${archive?.name ?? 'المرشح'}`}
        visible={archive !== null}
        close={() => {
          if (!busy) setArchive(null);
        }}
      >
        {archiveDate ? (
          <NativeDatePicker
            label="تاريخ نهاية الولاية"
            value={new Date(`${archiveDate}T12:00:00`)}
            onChange={(date) => setArchiveDate(localDay(date))}
            disabled={busy}
          />
        ) : (
          <Label secondary>سيستخدم الخادم تاريخ اليوم.</Label>
        )}
        <NativeAction
          title={archiveDate ? 'استخدام تاريخ اليوم على الخادم' : 'اختيار تاريخ محدد'}
          disabled={busy}
          onPress={() => setArchiveDate(archiveDate ? null : localDay(new Date()))}
        />
        <FormField
          disabled={busy}
          label="سبب الأرشفة"
          value={reason}
          maxLength={200}
          multiline
          onChange={setReason}
        />
        <NativePicker
          label="الخلف"
          value={successor}
          options={[
            { value: 'none', label: 'لا يوجد' },
            ...(archive && data ? eligibleSuccessors(archive, data.candidates) : []).map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
          onChange={setSuccessor}
          disabled={busy}
        />
        {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        <NativeAction
          title="أرشفة"
          disabled={busy || !canEdit}
          onPress={() => {
            if (archive)
              void mutate(() =>
                actions.archiveCandidate(archive.id, {
                  term_ended_at: archiveDate,
                  archive_reason: reason.trim() || null,
                  successor_id: successor === 'none' ? null : successor,
                }),
              ).then((saved) => {
                if (saved) setArchive(null);
              });
          }}
        />
      </EditorSheet>
    </Section>
  );
}

// PORT STATUS: source resources/js/Domain/polls/AdminPollManager.tsx and Pages/Dashboard/Index.tsx poll editor; confidence medium; todos 2 guarded alias deployment and authenticated non-production native editing proof.
