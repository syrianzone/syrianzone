import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import { api, ApiError } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, SearchField, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { useScreenActive } from '../../platform/lifecycle';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { usersAdminClient as client } from './api';
import { UserEditor } from './Editor';
import {
  ACTION_LABELS,
  initialForm,
  SORT_LABELS,
  userTarget,
  type BulkAction,
  type Sort,
  type Trashed,
  type UserForm,
  type UserQuery,
  type UserRecord
} from './model';

type Confirmation = { kind: 'mutation'; action: BulkAction; users: UserRecord[]; bulk: boolean } | { kind: 'self-save' } | { kind: 'discard' };
const displayDate = (value: string | null): string =>
  value ? new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'غير متاح';

export function UsersAdminScreen(props: FeatureScreenProps): React.JSX.Element {
  const account = useAccount(),
    [attempt, setAttempt] = useState(0);
  const owner = JSON.stringify([account.sessionGeneration, account.user?.id, account.user?.role, account.user?.effective_permissions, attempt]);
  return <UserAdministration key={owner} {...props} retryAccess={() => setAttempt((value) => value + 1)} />;
}
function UserAdministration({ params, retryAccess }: FeatureScreenProps & { retryAccess(): void }): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    active = useScreenActive(),
    { colors } = useTheme(),
    generation = account.sessionGeneration;
  const [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState<'selection' | 'mutation' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(params.edit && userTarget(params) === null ? 'معرّف المستخدم غير صالح.' : null),
    [notice, setNotice] = useState<string | null>(null),
    [progress, setProgress] = useState(0),
    [fields, setFields] = useState<Readonly<Record<string, readonly string[]>>>({});
  const alive = useRef(true),
    writing = useRef(false),
    selectionRevision = useRef(0),
    operation = useRef<AbortController | null>(null),
    initialized = useRef<string | null>(null);
  const [query, setQuery] = useState(''),
    [debounced, setDebounced] = useState(''),
    [sort, setSort] = useState<Sort>('name'),
    [direction, setDirection] = useState<'asc' | 'desc'>('asc'),
    [trashed, setTrashed] = useState<Trashed>('without'),
    [page, setPage] = useState(1),
    [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<number, UserRecord>>({}),
    [showCreated, setShowCreated] = useState(false),
    [showDeleted, setShowDeleted] = useState(false);
  const [target, setTarget] = useState<number | 'create' | null>(() => userTarget(params)),
    [form, setForm] = useState<UserForm | null>(null),
    [original, setOriginal] = useState<UserRecord | null>(null),
    [confirm, setConfirm] = useState<Confirmation | null>(null);
  const current = () => alive.current && generation === api.getSessionGeneration();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!active) {
      operation.current?.abort();
      setForm((value) => (value ? { ...value, password: '' } : value));
    }
  }, [active]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
      setSelected({});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const checked = useCallback(async <T,>(load: () => Promise<T>): Promise<T> => {
    try {
      return await load();
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) setBlocked(true);
      throw reason;
    }
  }, []);
  const options = useResource(
    useCallback((signal) => checked(() => client.options(generation, signal)), [checked, generation]),
    { enabled: account.ready && account.user !== null && !blocked && !account.busy }
  );
  const authorized = account.ready && !blocked && options.data?.actorId === account.user?.id;
  const filters = useMemo<UserQuery>(
    () => ({ query: debounced, sort, direction, trashed, page, perPage }),
    [debounced, sort, direction, trashed, page, perPage]
  );
  const users = useResource(
    useCallback((signal) => checked(() => client.list(filters, generation, signal)), [filters, generation, checked]),
    { enabled: authorized }
  );
  useEffect(() => {
    if (users.data && users.data.currentPage > users.data.lastPage) setPage(users.data.lastPage);
  }, [users.data]);
  const detail = useResource(
    useCallback((signal) => checked(() => client.show(typeof target === 'number' ? target : 0, generation, signal)), [target, generation, checked]),
    { enabled: authorized && typeof target === 'number' }
  );
  useEffect(() => {
    if (!authorized || !options.data || target === null) return;
    const key = String(target);
    if (initialized.current === key) return;
    if (target === 'create') {
      setOriginal(null);
      setForm(initialForm(null, options.data));
      initialized.current = key;
    } else if (detail.data?.id === target) {
      setOriginal(detail.data);
      setForm(initialForm(detail.data, options.data));
      initialized.current = key;
    }
  }, [authorized, target, detail.data, options.data]);
  const run = async (kind: 'selection' | 'mutation' | 'save', task: (origin: number, signal: AbortSignal) => Promise<void>) => {
    if (!authorized || busy || writing.current || account.busy || !current()) return;
    const controller = new AbortController();
    operation.current = controller;
    writing.current = true;
    setBusy(true);
    setPhase(kind);
    setError(null);
    setNotice(null);
    setFields({});
    setProgress(0);
    try {
      await task(generation, controller.signal);
    } catch (reason) {
      if (current()) {
        setError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء.');
        if (reason instanceof ApiError) {
          setFields(reason.fields);
          if (reason.status === 401 || reason.status === 403) setBlocked(true);
        }
      }
    } finally {
      writing.current = false;
      if (operation.current === controller) operation.current = null;
      if (current()) {
        setBusy(false);
        setPhase(null);
      }
    }
  };
  const openEditor = (id: number | 'create') => {
    if (busy) return;
    initialized.current = null;
    setForm(null);
    setOriginal(null);
    setTarget(id);
    setConfirm(null);
    setError(null);
    setFields({});
  };
  const closeEditor = () => {
    if (busy) return;
    setTarget(null);
    setForm(null);
    setOriginal(null);
    setConfirm(null);
    initialized.current = null;
  };
  const save = () => {
    if (!form || !options.data) return;
    void run('save', async (origin) => {
      const result = await client.save(form, options.data!, origin);
      if (!current()) return;
      setForm(null);
      setTarget(null);
      setConfirm(null);
      initialized.current = null;
      users.reload();
      setSelected({});
      setNotice(`تم حفظ المستخدم «${result.user.name}».`);
      if (!result.actorCanManage) setBlocked(true);
      if (result.user.isSelf) await account.refresh();
    });
  };
  const selectAll = () => {
    const revision = selectionRevision.current;
    void run('selection', async (origin, signal) => {
      const snapshot = await checked(() =>
        client.selectAll(filters, origin, signal, (count) => {
          if (current()) setProgress(count);
        })
      );
      if (signal.aborted || selectionRevision.current !== revision) throw new Error('تم إلغاء تحديد المستخدمين.');
      if (current()) {
        setSelected(Object.fromEntries(snapshot.map((user) => [user.id, user])));
        setNotice(`تم تحديد ${snapshot.length} مستخدماً مطابقاً.`);
      }
    });
  };
  const mutate = (request: Extract<Confirmation, { kind: 'mutation' }>) => {
    if (!options.data) return;
    void run('mutation', async (origin, signal) => {
      const result = request.bulk
        ? await client.bulkAll(
            request.action,
            request.users,
            options.data!.bulkMax,
            origin,
            (count) => {
              if (current()) setProgress(count);
            },
            signal
          )
        : await client
            .mutate(request.action, request.users[0]!, origin)
            .then((value) => ({ completed: request.users, remaining: [] as UserRecord[], actorDeleted: value.actorDeleted, error: null }));
      if (!current()) return;
      setSelected(Object.fromEntries(result.remaining.map((user) => [user.id, user])));
      setConfirm(null);
      setForm(null);
      setTarget(null);
      initialized.current = null;
      users.reload();
      setNotice(`تم تأكيد ${ACTION_LABELS[request.action]} ${result.completed.length} مستخدماً من ${request.users.length}.`);
      if (result.error) {
        setError(
          `${result.error instanceof Error ? result.error.message : 'تعذّر إكمال الإجراء.'} لم يُؤكّد تغيير ${result.remaining.length} مستخدماً. أعد قراءة القائمة وتحديدهم قبل المحاولة.`
        );
        if (result.error instanceof ApiError && (result.error.status === 401 || result.error.status === 403)) setBlocked(true);
      }
      if (result.actorDeleted) {
        setBlocked(true);
        await account.clearDeletedSession(origin);
      }
    });
  };
  const invalidateSelection = () => {
    selectionRevision.current++;
    if (phase === 'selection') operation.current?.abort();
    setSelected({});
  };
  const filterChange = (change: () => void) => {
    invalidateSelection();
    change();
    setPage(1);
  };
  const picked = Object.values(selected),
    messages = (
      <>
        {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        {notice ? <Label style={{ color: colors.success }}>{notice}</Label> : null}
      </>
    );
  const header = (
    <View style={{ gap: 14 }}>
      <Heading subtitle="إدارة المستخدمين والصلاحيات والحذف والاستعادة">المستخدمون</Heading>
      <NativeAction title="العودة إلى لوحة التحكم" onPress={() => navigation.open('dashboard')} />
      {messages}
      {!account.user ? <NativeAction title="تسجيل الدخول" onPress={() => navigation.open('account')} /> : null}
      <RequestStatus resource={options} />
      {blocked ? (
        <Section>
          <Label>تعذّر تأكيد صلاحية إدارة المستخدمين. البيانات الخاصة مخفية.</Label>
          <NativeAction title="إعادة قراءة صلاحية الوصول" onPress={retryAccess} />
        </Section>
      ) : null}
      {authorized && options.data ? (
        <>
          <NativeAction title="إنشاء مستخدم" systemImage="plus" disabled={busy} onPress={() => openEditor('create')} />
          <SearchField value={query} onChange={(value) => { invalidateSelection(); setQuery(value.slice(0, 255)); }} placeholder="ابحث بالاسم أو البريد الإلكتروني" />
          <NativePicker<Trashed>
            label="حالة الحذف"
            value={trashed}
            disabled={busy}
            options={[
              { value: 'without', label: 'المستخدمون غير المحذوفين' },
              { value: 'with', label: 'جميع المستخدمين مع المحذوفين' },
              { value: 'only', label: 'المحذوفون فقط' }
            ]}
            onChange={(value) => filterChange(() => setTrashed(value))}
          />
          <NativePicker<Sort>
            label="الترتيب حسب"
            value={sort}
            disabled={busy}
            options={options.data.sorts.map((value) => ({ value, label: SORT_LABELS[value] }))}
            onChange={(value) => filterChange(() => setSort(value))}
          />
          <NativePicker
            label="اتجاه الترتيب"
            value={direction}
            disabled={busy}
            options={[
              { value: 'asc', label: 'تصاعدي' },
              { value: 'desc', label: 'تنازلي' }
            ]}
            onChange={(value) => filterChange(() => setDirection(value))}
          />
          <NativePicker
            label="عدد المستخدمين في الصفحة"
            value={String(perPage)}
            disabled={busy}
            options={[5, 10, 25, 50, 100]
              .filter((value) => value <= options.data!.perPageMax)
              .map((value) => ({ value: String(value), label: String(value) }))}
            onChange={(value) => filterChange(() => setPerPage(Number(value)))}
          />
          <NativeToggle title="إظهار تاريخ الإنشاء" value={showCreated} onChange={setShowCreated} />
          <NativeToggle title="إظهار تاريخ الحذف" value={showDeleted} onChange={setShowDeleted} />
          <RequestStatus resource={users} />
          <Label>
            {users.data?.total ?? 0} مستخدماً، محدد {picked.length}
          </Label>
          <NativeAction title="تحديث القائمة" onPress={users.reload} disabled={busy || users.loading} />
          <NativeAction
            title="تحديد هذه الصفحة"
            disabled={busy || !users.data?.items.length}
            onPress={() =>
              setSelected((previous) => ({ ...previous, ...Object.fromEntries((users.data?.items ?? []).map((user) => [user.id, user])) }))
            }
          />
          <NativeAction title={`تحديد جميع النتائج (${users.data?.total ?? 0})`} disabled={busy || !users.data?.total} onPress={selectAll} />
          <NativeAction title="إلغاء التحديد" disabled={busy || !picked.length} onPress={() => setSelected({})} />
          {picked.length ? (
            <Section>
              <Label>التغييرات تشمل {picked.length} مستخدماً محدداً عبر الصفحات.</Label>
              {(['delete', 'restore', 'force-delete'] as const)
                .filter((action) => (action === 'delete' ? trashed !== 'only' : trashed !== 'without'))
                .map((action) => (
                  <NativeAction
                    key={action}
                    title={`${ACTION_LABELS[action]} المحددين`}
                    destructive={action !== 'restore'}
                    disabled={busy}
                    onPress={() => setConfirm({ kind: 'mutation', action, users: picked, bulk: true })}
                  />
                ))}
            </Section>
          ) : null}
          {busy ? (
            <Section>
              <Label>
                {phase === 'selection'
                  ? `جارٍ تحديد النتائج: ${progress}`
                  : phase === 'mutation'
                    ? `تم تأكيد تغيير ${progress} مستخدماً`
                    : 'جارٍ حفظ المستخدم'}
              </Label>
              {phase !== 'save' ? (
                <NativeAction
                  title={phase === 'selection' ? 'إيقاف التحديد' : 'إيقاف التغييرات المتبقية'}
                  onPress={() => operation.current?.abort()}
                />
              ) : null}
            </Section>
          ) : null}
        </>
      ) : null}
    </View>
  );
  return (
    <>
      <AdaptivePanes
        primary={
          <FlatList
            data={authorized ? (users.data?.items ?? []) : []}
            keyExtractor={(user) => String(user.id)}
            contentContainerStyle={contentStyle}
            ListHeaderComponent={header}
            renderItem={({ item }) => (
              <Section style={{ marginVertical: 8 }}>
                <NativeToggle
                  title={`تحديد ${item.name}`}
                  value={selected[item.id] !== undefined}
                  disabled={busy}
                  onChange={(value) =>
                    setSelected((previous) => {
                      const next = { ...previous };
                      if (value) next[item.id] = item;
                      else delete next[item.id];
                      return next;
                    })
                  }
                />
                <Heading>{item.name}</Heading>
                <Label>{item.email}</Label>
                <Label secondary>
                  {options.data?.roles.find((role) => role.value === item.role)?.label ?? item.role}، {item.banned ? 'محظور' : 'غير محظور'}
                  {item.deletedAt ? '، محذوف مؤقتاً' : ''}
                  {item.isSelf ? '، حسابك' : ''}
                </Label>
                {showCreated ? <Label secondary>الإنشاء: {displayDate(item.createdAt)}</Label> : null}
                {showDeleted ? <Label secondary>الحذف: {displayDate(item.deletedAt)}</Label> : null}
                {item.actions.edit ? <NativeAction title={`تعديل ${item.name}`} disabled={busy} onPress={() => openEditor(item.id)} /> : null}
                {(['delete', 'restore', 'force-delete'] as const)
                  .filter((action) =>
                    action === 'delete' ? item.actions.remove : action === 'restore' ? item.actions.restore : item.actions.forceDelete
                  )
                  .map((action) => (
                    <NativeAction
                      key={action}
                      title={`${ACTION_LABELS[action]} ${item.name}`}
                      destructive={action !== 'restore'}
                      disabled={busy}
                      onPress={() => setConfirm({ kind: 'mutation', action, users: [item], bulk: false })}
                    />
                  ))}
              </Section>
            )}
            ListEmptyComponent={authorized && !users.loading && !users.error ? <EmptyState title="لا يوجد مستخدمون مطابقون" /> : <View />}
            ListFooterComponent={
              authorized && users.data ? (
                <Section>
                  <Label>
                    الصفحة {users.data.currentPage} من {users.data.lastPage}
                  </Label>
                  <NativeAction title="الصفحة السابقة" disabled={busy || page <= 1} onPress={() => setPage((value) => value - 1)} />
                  <NativeAction title="الصفحة التالية" disabled={busy || page >= users.data.lastPage} onPress={() => setPage((value) => value + 1)} />
                </Section>
              ) : (
                <View />
              )
            }
          />
        }
      />
      <Modal
        visible={authorized && (target !== null || confirm !== null)}
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!busy) {
            closeEditor();
            setConfirm(null);
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AdaptivePanes
            primary={
              <ScrollView
                contentContainerStyle={contentStyle}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                keyboardDismissMode="interactive"
              >
                {confirm ? (
                  <>
                    <Heading>
                      {confirm.kind === 'self-save'
                        ? 'تغيير دور حسابك؟'
                        : confirm.kind === 'discard'
                          ? 'تجاهل التعديلات؟'
                          : `تأكيد ${ACTION_LABELS[confirm.action]}`}
                    </Heading>
                    <Label>
                      {confirm.kind === 'self-save'
                        ? 'ستُحفظ تغييرات حسابك وقد تفقد صلاحية إدارة المستخدمين. سيُعاد التحقق من حسابك بعد الحفظ.'
                        : confirm.kind === 'discard'
                          ? 'ستُحذف التعديلات غير المحفوظة وتُقرأ آخر نسخة من الخادم.'
                          : `${ACTION_LABELS[confirm.action]} ${confirm.users.length} مستخدماً. ${confirm.action === 'force-delete' ? 'الحذف النهائي لا يمكن التراجع عنه ويشمل العلاقات التي يحذفها الخادم.' : confirm.action === 'delete' ? 'يمكن لمدير آخر استعادة المستخدمين المحذوفين مؤقتاً.' : 'سيعود المستخدمون المحذوفون إلى قائمة المستخدمين.'}`}
                    </Label>
                    {confirm.kind === 'mutation' && confirm.action !== 'restore' && confirm.users.some((user) => user.isSelf) ? (
                      <Label style={{ color: colors.danger }}>التحديد يشمل حسابك. حذفه ينهي تسجيل دخولك بعد إكمال التغييرات المؤكدة.</Label>
                    ) : null}
                    {messages}
                    {busy && phase === 'mutation' ? (
                      <>
                        <Label>تم تأكيد تغيير {progress} مستخدماً.</Label>
                        <NativeAction title="إيقاف التغييرات المتبقية" onPress={() => operation.current?.abort()} />
                      </>
                    ) : null}
                    <NativeAction
                      title="تأكيد الإجراء"
                      prominent
                      disabled={busy}
                      onPress={() => {
                        if (confirm.kind === 'self-save') save();
                        else if (confirm.kind === 'discard') {
                          initialized.current = null;
                          setForm(null);
                          detail.reload();
                          setConfirm(null);
                        } else mutate(confirm);
                      }}
                    />
                    <NativeAction title="العودة دون تنفيذ" disabled={busy} onPress={() => setConfirm(null)} />
                  </>
                ) : form && options.data ? (
                  <>
                    <UserEditor
                      form={form}
                      original={original}
                      options={options.data}
                      busy={busy}
                      fields={fields}
                      update={(patch) => setForm((previous) => (previous ? { ...previous, ...patch } : previous))}
                      onSave={() => {
                        if (original?.isSelf && original.role !== form.role) setConfirm({ kind: 'self-save' });
                        else save();
                      }}
                      onReload={() => {
                        if (original && options.data && JSON.stringify(form) !== JSON.stringify(initialForm(original, options.data)))
                          setConfirm({ kind: 'discard' });
                        else {
                          initialized.current = null;
                          setForm(null);
                          detail.reload();
                        }
                      }}
                    />
                    {messages}
                    <NativeAction title="إلغاء" disabled={busy} onPress={closeEditor} />
                  </>
                ) : (
                  <>
                    <RequestStatus resource={detail} />
                    <Label>جارٍ قراءة سجل المستخدم.</Label>
                    <NativeAction title="إلغاء" disabled={busy} onPress={closeEditor} />
                  </>
                )}
              </ScrollView>
            }
          />
        </View>
      </Modal>
    </>
  );
}
// PORT STATUS: source Filament UserResource list/create/edit/bulk actions; confidence medium; todos 2 controlled-account native verification and privilege-refresh/component regression coverage.
