import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { api } from '../../api';
import {
  AdaptivePanes,
  contentStyle,
  FormField,
  Heading,
  Label,
  RequestStatus,
  Section,
} from '../../components';
import { useAccount } from '../../platform/account';
import { formatGregorianSyrianShort } from '../../platform/dates';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { pollAdminApi } from './api';
import {
  allowedAdminCards,
  canModule,
  corePollSlug,
  dashboardAdminDestination,
  decodeDashboard,
  defaultPollTimezone,
  initialDashboardTab,
  pollFormErrors,
} from './model';
import { EditorSheet, PollEditor } from './PollEditor';
const noPermissions: readonly string[] = [];

export function DashboardScreen(props: FeatureScreenProps): React.JSX.Element {
  const account = useAccount();
  return (
    <DashboardPanel
      key={JSON.stringify([account.sessionGeneration, account.user?.effective_permissions])}
      {...props}
    />
  );
}
function DashboardPanel({ params }: FeatureScreenProps): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    { colors } = useTheme(),
    permissions = account.user?.effective_permissions ?? noPermissions,
    stamp = account.sessionGeneration;
  const page = useResource(
    useCallback(
      (signal) =>
        api.page('/dashboard', 'Dashboard/Index', decodeDashboard, {
          signal,
          authenticated: true,
          sessionGeneration: stamp,
        }),
      [stamp],
    ),
    { enabled: Boolean(account.user) },
  );
  const [tab, setTab] = useState('profile'),
    [editingPoll, setEditingPoll] = useState<string | null>(null),
    [createOpen, setCreateOpen] = useState(false),
    [title, setTitle] = useState(''),
    [slug, setSlug] = useState(''),
    [active, setActive] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    initialized = useRef(false),
    locked = useRef(false);
  const canManage = canModule(permissions, 'polls'),
    canCreate = permissions.includes('polls.create'),
    canEdit = permissions.includes('polls.edit'),
    canDelete = permissions.includes('polls.delete');
  const cards = allowedAdminCards(permissions).map(card => ({ ...card, destination: dashboardAdminDestination(card.id, permissions) }));
  useEffect(() => {
    if (!page.data || initialized.current) return;
    initialized.current = true;
    let initial = initialDashboardTab(params, permissions, page.data.canSubmit);
    const target = params['edit-poll'] ?? params.edit ?? params.poll;
    if (target && canManage) {
      initial = 'polls';
      setEditingPoll(
        page.data.polls.find((poll) => poll.id === target || poll.slug === target)?.id ?? target,
      );
    }
    if (canCreate && (params['create-poll'] === '1' || params.create === '1')) {
      initial = 'polls';
      setCreateOpen(true);
    }
    setTab(initial);
  }, [page.data, params, permissions, canManage, canCreate]);
  useEffect(() => {
    initialized.current = false;
    setEditingPoll(null);
    setCreateOpen(false);
    setError(null);
  }, [stamp]);
  async function perform(work: () => Promise<void>): Promise<void> {
    if (locked.current || account.busy) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      if (api.getSessionGeneration() === stamp) page.reload();
    } catch (reason) {
      if (api.getSessionGeneration() === stamp)
        setError(reason instanceof Error ? reason.message : 'تعذر تحديث لوحة التحكم.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const showSubmissions = Boolean(page.data && (page.data.canSubmit || page.data.submissions.length)),
    tabs = [
      { value: 'profile', label: 'الحساب' },
      ...(showSubmissions ? [{ value: 'submissions', label: 'اقتراحاتي للخطوط' }] : []),
      ...(canManage ? [{ value: 'polls', label: 'تير ليست' }] : []),
    ];
  return (
    <AdaptivePanes
      primary={
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          <Heading>لوحة التحكم</Heading>
          {!account.user ? (
            <Section>
              <Label>سجّل الدخول للوصول إلى ملفك ومساهماتك.</Label>
              <NativeAction title="الحساب وتسجيل الدخول" onPress={() => navigation.open('account')} />
              {account.error ? <Label style={{ color: colors.danger }}>{account.error}</Label> : null}
            </Section>
          ) : (
            <>
              <RequestStatus resource={page} />
              {page.data?.banned ? (
                <Section>
                  <Label style={{ color: colors.danger }}>
                    تم حظر حسابك من المساهمة. لا يمكنك إرسال مسارات نقل أو أماكن جديدة حالياً.
                  </Label>
                </Section>
              ) : null}
              <NativePicker
                label="قسم لوحة التحكم"
                value={tab}
                options={tabs}
                onChange={(value) => {
                  setTab(value);
                  setEditingPoll(null);
                }}
              />
              {tab === 'profile' ? (
                <Section>
                  <Label>إعدادات الحساب الشخصي</Label>
                  <NativeAction
                    title="الاسم والبريد والصورة وإعدادات الحساب"
                    systemImage="person.crop.circle"
                    onPress={() => navigation.open('account')}
                  />
                </Section>
              ) : null}
              {tab === 'submissions' && showSubmissions ? (
                <Section>
                  <Heading>سجل اقتراحات المسارات الخاصة بك</Heading>
                  {!page.data?.submissions.length ? (
                    <>
                      <Label secondary>لم تقدم اقتراحات مسارات للخطوط بعد.</Label>
                      <NativeAction
                        title="اقتراح خط جديد في استوديو ترانزيت"
                        onPress={() => navigation.open('transit_studio')}
                      />
                    </>
                  ) : null}
                  {page.data?.submissions.map((draft) => (
                    <Section key={draft.id} style={{ backgroundColor: colors.elevated }}>
                      <Label style={{ fontWeight: '700' }}>
                        {draft.name}
                        {draft.nameEn ? ` (${draft.nameEn})` : ''}
                      </Label>
                      <Label secondary>
                        {draft.status === 'approved'
                          ? 'تم القبول والنشر'
                          : draft.status === 'rejected'
                            ? 'مرفوض'
                            : 'قيد المراجعة'}
                        {draft.routeId ? '، تعديل مقترح لخط منشور' : ''}
                      </Label>
                      <Label secondary>
                        المدينة: {draft.city}، تاريخ التقديم: {formatGregorianSyrianShort(draft.createdAt)}
                      </Label>
                      {draft.status === 'rejected' && draft.reason ? (
                        <Label style={{ color: colors.danger }}>ملاحظات التدقيق: {draft.reason}</Label>
                      ) : null}
                      {draft.status === 'pending' ? (
                        <NativeAction
                          title="سحب الاقتراح"
                          destructive
                          disabled={busy}
                          onPress={() =>
                            Alert.alert('سحب هذا الاقتراح؟', 'سيتم إلغاء الاقتراح ولا يمكن التراجع.', [
                              { text: 'إلغاء', style: 'cancel' },
                              {
                                text: 'سحب',
                                style: 'destructive',
                                onPress: () => {
                                  void perform(async () => {
                                    await api.request(`transit/studio/routes/${draft.id}`, () => undefined, {
                                      method: 'DELETE',
                                      authenticated: true,
                                      sessionGeneration: stamp,
                                    });
                                  });
                                },
                              },
                            ])
                          }
                        />
                      ) : null}
                      {!page.data?.banned ? (
                        <NativeAction
                          title="تعديل الاقتراح"
                          disabled={busy}
                          onPress={() => navigation.open('transit_studio', { edit: String(draft.id) })}
                        />
                      ) : null}
                      {draft.status === 'approved' && draft.routeId ? (
                        <NativeAction
                          title="عرض الخط المنشور"
                          onPress={() =>
                            navigation.open('transit', { cityId: draft.cityId, routeId: draft.routeId ?? '' })
                          }
                        />
                      ) : null}
                    </Section>
                  ))}
                </Section>
              ) : null}
              {tab === 'polls' && canManage ? (
                <Section>
                  <Heading>إدارة استبيانات التقييم</Heading>
                  <NativeAction
                    title="إنشاء استبيان جديد"
                    prominent
                    disabled={!canCreate || busy}
                    onPress={() => {
                      setError(null);
                      setCreateOpen(true);
                    }}
                  />
                  {page.data && !page.data.polls.length ? (
                    <Label secondary>لا توجد استبيانات مسجلة حالياً.</Label>
                  ) : null}
                  {page.data?.polls.map((poll) => (
                    <Section key={poll.id} style={{ backgroundColor: colors.elevated }}>
                      <Label style={{ fontWeight: '700' }}>{poll.title}</Label>
                      <Label secondary>
                        {poll.slug}، {poll.count} مرشحاً، {poll.active ? 'نشط' : 'معطل'}
                      </Label>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <NativeAction
                          title="صفحة التصويت"
                          style={{ flexBasis: 140, flexGrow: 1 }}
                          onPress={() => navigation.open('tierlist', { poll: poll.slug })}
                        />
                        <NativeAction
                          title="النتائج"
                          style={{ flexBasis: 140, flexGrow: 1 }}
                          onPress={() =>
                            navigation.open('tierlist', { view: 'leaderboard', poll: poll.slug })
                          }
                        />
                      </View>
                      <NativeAction
                        title={
                          editingPoll === poll.id
                            ? 'إغلاق المحرر'
                            : canEdit
                              ? 'تعديل الاستبيان'
                              : 'إدارة المجموعات والمرشحين'
                        }
                        disabled={busy}
                        onPress={() => setEditingPoll(editingPoll === poll.id ? null : poll.id)}
                      />
                      {canDelete && poll.slug !== corePollSlug ? (
                        <NativeAction
                          title="حذف الاستبيان"
                          destructive
                          disabled={busy}
                          onPress={() =>
                            Alert.alert('حذف هذا الاستبيان؟', 'سيتم حذف الاستبيان وجميع مرشحيه نهائياً.', [
                              { text: 'إلغاء', style: 'cancel' },
                              {
                                text: 'حذف',
                                style: 'destructive',
                                onPress: () => {
                                  void perform(async () => {
                                    await pollAdminApi(stamp).remove(poll.id);
                                    if (api.getSessionGeneration() === stamp && editingPoll === poll.id)
                                      setEditingPoll(null);
                                  });
                                },
                              },
                            ])
                          }
                        />
                      ) : poll.slug === corePollSlug ? (
                        <Label secondary>الاستبيان الأساسي غير قابل للحذف أو إعادة التسمية.</Label>
                      ) : null}
                    </Section>
                  ))}
                  {editingPoll ? (
                    <PollEditor
                      key={`${stamp}:${editingPoll}`}
                      pollId={editingPoll}
                      onChanged={page.reload}
                      onClose={() => setEditingPoll(null)}
                    />
                  ) : null}
                </Section>
              ) : null}
              {cards.length ? (
                <Section>
                  <Heading>أدوات الإدارة المتاحة لحسابك</Heading>
                  {cards.map((card) => (
                    <View key={card.id} style={{ gap: 4 }}>
                      <NativeAction
                        title={card.label}
                        disabled={!card.destination}
                        onPress={() => { if (card.destination) navigation.open(...card.destination); }}
                      />
                      {!card.destination ? (
                        <Label secondary>غير متاحة في هذه النسخة حالياً.</Label>
                      ) : null}
                    </View>
                  ))}
                </Section>
              ) : null}
              {page.data?.canManageUsers ? (
                <Section>
                  <Label>إدارة المستخدمين</Label>
                  <NativeAction
                    title="المستخدمون وصلاحياتهم"
                    systemImage="person.2"
                    onPress={() => navigation.open('users_admin')}
                  />
                </Section>
              ) : null}
            </>
          )}
          {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
          <EditorSheet
            title="إنشاء استبيان جديد"
            visible={createOpen && canCreate}
            close={() => {
              if (!busy) setCreateOpen(false);
            }}
          >
            <FormField label="العنوان" value={title} maxLength={200} autoCorrect={false} onChange={setTitle} />
            <FormField label="المعرف (Slug)" value={slug} keyboardType="url" maxLength={100} onChange={setSlug} />
            <Label secondary>حروف وأرقام وشرطات فقط. يُستخدم في رابط صفحة التصويت.</Label>
            <NativeToggle title="تفعيل الاستبيان فور الإنشاء" value={active} onChange={setActive} />
            {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
            <NativeAction
              title="إنشاء ومتابعة التحرير"
              prominent
              disabled={busy || !title.trim() || !slug.trim()}
              onPress={() => {
                const errors = pollFormErrors(title, slug);
                if (Object.keys(errors).length) {
                  setError(Object.values(errors).join(' '));
                  return;
                }
                void perform(async () => {
                  const poll = await pollAdminApi(stamp).create({
                    title: title.trim(),
                    slug: slug.trim(),
                    timezone: defaultPollTimezone,
                    is_active: active,
                  });
                  if (api.getSessionGeneration() !== stamp) return;
                  setCreateOpen(false);
                  setTitle('');
                  setSlug('');
                  setActive(true);
                  setEditingPoll(poll.id);
                  setTab('polls');
                });
              }}
            />
          </EditorSheet>
        </ScrollView>
      }
    />
  );
}
export default DashboardScreen;

// PORT STATUS: source resources/js/Pages/Dashboard/Index.tsx; confidence medium; todos 2 guarded JSON alias rollout and remaining native admin interaction proof.
