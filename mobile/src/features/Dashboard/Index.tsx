import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertCircle,
  Ban,
  Bus,
  Camera,
  Edit,
  ListOrdered,
  MapPinned,
  Plus,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import {
  deleteAdminPoll,
  fetchAdminPollCatalog,
  type AdminPollCatalogItem,
} from '@/components/admin/api';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import CreatePoll from '@/features/Admin/Polls/Create';
import EditPoll from '@/features/Admin/Polls/Edit';
import { canManageGovernmentApps } from '@/features/GovApps/Admin/Index';
import { canManagePhonebook } from '@/features/Phonebook/Admin/Index';
import { canManageSyOfficial } from '@/features/SyOfficial/Admin/Index';
import { apiOrigin } from '@/lib/env';
import type { AuthUser } from '@/lib/auth/types';

import {
  deleteDashboardAccount,
  fetchDashboardAccount,
  updateDashboardAccount,
  updateDashboardAvatar,
  withdrawDashboardDraft,
} from './api';
import {
  dashboardCapabilities,
  dashboardTabFromParam,
  type DashboardTab,
  defaultDashboardTab,
  draftStatusLabel,
  roleLabel,
} from './model';

type DashboardMode = 'dashboard' | 'poll-create' | 'poll-edit';

interface DashboardContentProps {
  initialTab: DashboardTab | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  user: AuthUser;
}

function DashboardContent({
  initialTab,
  logout,
  refreshUser,
  user,
}: DashboardContentProps) {
  const { theme } = useAppTheme();
  const [mode, setMode] = useState<DashboardMode>('dashboard');
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [requestedTab, setRequestedTab] = useState<DashboardTab | null>(initialTab);
  const [withdrawingDraftId, setWithdrawingDraftId] = useState<number | null>(null);
  const [profileName, setProfileName] = useState(user.name);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingPollId, setDeletingPollId] = useState<string | null>(null);
  const accountQuery = useQuery({
    queryFn: ({ signal }) => fetchDashboardAccount(signal),
    queryKey: ['dashboard-account', user.id],
  });
  const accountUser = accountQuery.data?.user ?? user;
  const capabilities = dashboardCapabilities(accountUser);
  const canManageGovApps = canManageGovernmentApps(accountUser);
  const canManagePhoneDirectory = canManagePhonebook(accountUser);
  const canManageOfficialDirectory = canManageSyOfficial(accountUser);
  const allowedTabs = useMemo(() => {
    const tabs: DashboardTab[] = ['profile'];
    if (capabilities.canViewSubmissions) {
      tabs.unshift('submissions');
    }
    if (capabilities.canManagePolls) {
      tabs.unshift('polls');
    }
    return tabs;
  }, [capabilities.canManagePolls, capabilities.canViewSubmissions]);
  const activeTab =
    requestedTab && allowedTabs.includes(requestedTab)
      ? requestedTab
      : defaultDashboardTab(accountUser.role);
  const pollsQuery = useQuery({
    enabled: capabilities.canManagePolls,
    queryFn: ({ signal }) => fetchAdminPollCatalog(signal),
    queryKey: ['admin-poll-catalog', user.id],
  });
  const myDrafts = accountQuery.data?.myDrafts ?? [];

  if (mode === 'poll-create') {
    return (
      <CreatePoll
        onBack={() => setMode('dashboard')}
        onCreated={(poll) => {
          setEditingPollId(poll.id);
          setMode('poll-edit');
          void pollsQuery.refetch();
        }}
      />
    );
  }
  if (mode === 'poll-edit') {
    return (
      <EditPoll
        onBack={() => {
          setMode('dashboard');
          setEditingPollId(null);
          void pollsQuery.refetch();
        }}
        onSaved={() => void pollsQuery.refetch()}
        pollId={editingPollId ?? undefined}
      />
    );
  }

  const updateProfile = async () => {
    if (!profileName.trim() || !profileEmail.trim()) {
      setProfileMessage({
        text: 'الاسم والبريد الإلكتروني مطلوبان.',
        type: 'error',
      });
      return;
    }
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      await updateDashboardAccount({
        email: profileEmail.trim(),
        name: profileName.trim(),
      });
      await Promise.all([refreshUser(), accountQuery.refetch()]);
      setProfileMessage({
        text: 'تم تحديث معلومات الحساب بنجاح.',
        type: 'success',
      });
    } catch (cause) {
      setProfileMessage({
        text:
          cause instanceof Error
            ? cause.message
            : 'تعذر تحديث الحساب.',
        type: 'error',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const pickAvatar = async () => {
    setProfileMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setProfileMessage({
        text: 'يلزم السماح بالوصول إلى الصور لاختيار صورة الحساب.',
        type: 'error',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 0.9,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) {
      return;
    }
    if (asset.fileSize && asset.fileSize > 4 * 1_024 * 1_024) {
      setProfileMessage({
        text: 'يجب ألا يتجاوز حجم صورة الحساب 4 MB.',
        type: 'error',
      });
      return;
    }

    setAvatarLoading(true);
    try {
      await updateDashboardAvatar({
        fileName: asset.fileName ?? 'profile-avatar.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
        uri: asset.uri,
      });
      await Promise.all([refreshUser(), accountQuery.refetch()]);
      setProfileMessage({
        text: 'تم تحديث صورة الحساب بنجاح.',
        type: 'success',
      });
    } catch (cause) {
      setProfileMessage({
        text:
          cause instanceof Error
            ? cause.message
            : 'تعذر تحديث صورة الحساب.',
        type: 'error',
      });
    } finally {
      setAvatarLoading(false);
    }
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      'تأكيد حذف الحساب نهائيًا؟',
      'سيتم إخفاء بياناتك الشخصية وتفويض الاستبيانات والمسارات المنشورة للمدير العام. لا يمكن التراجع عن هذا الإجراء.',
      [
        { style: 'cancel', text: 'إلغاء وتراجع' },
        {
          onPress: () => {
            setDeleteLoading(true);
            setProfileMessage(null);
            void deleteDashboardAccount()
              .then(() => logout())
              .catch((cause: unknown) =>
                setProfileMessage({
                  text:
                    cause instanceof Error
                      ? cause.message
                      : 'تعذر حذف الحساب حاليًا.',
                  type: 'error',
                }),
              )
              .finally(() => setDeleteLoading(false));
          },
          style: 'destructive',
          text: 'تأكيد الحذف نهائيًا',
        },
      ],
    );
  };

  const withdrawDraft = (id: number) => {
    Alert.alert(
      'سحب الاقتراح؟',
      'هل تريد إلغاء وسحب هذا الاقتراح؟',
      [
        { style: 'cancel', text: 'إلغاء' },
        {
          onPress: () => {
            setWithdrawingDraftId(id);
            void withdrawDashboardDraft(id)
              .then(async () => {
                await accountQuery.refetch();
                Alert.alert('تم سحب الاقتراح.');
              })
              .catch((cause: unknown) =>
                Alert.alert(
                  cause instanceof Error
                    ? cause.message
                    : 'تعذر سحب الاقتراح.',
                ),
              )
              .finally(() => setWithdrawingDraftId(null));
          },
          style: 'destructive',
          text: 'سحب',
        },
      ],
    );
  };

  const confirmPollDeletion = (poll: AdminPollCatalogItem) => {
    if (poll.slug === 'best-ministers') {
      Alert.alert('لا يمكن حذف استبيان تقييم الوزراء الرئيسي.');
      return;
    }
    Alert.alert(
      'حذف الاستبيان؟',
      'سيتم حذف الاستبيان وجميع مرشحيه نهائيًا.',
      [
        { style: 'cancel', text: 'إلغاء' },
        {
          onPress: () => {
            setDeletingPollId(poll.id);
            void deleteAdminPoll(poll.id)
              .then(() => pollsQuery.refetch())
              .catch((cause: unknown) =>
                Alert.alert(
                  cause instanceof Error
                    ? cause.message
                    : 'تعذر حذف الاستبيان.',
                ),
              )
              .finally(() => setDeletingPollId(null));
          },
          style: 'destructive',
          text: 'حذف',
        },
      ],
    );
  };

  return (
    <Screen
      onRefresh={() =>
        void Promise.all([
          accountQuery.refetch(),
          capabilities.canManagePolls ? pollsQuery.refetch() : Promise.resolve(),
        ])
      }
      refreshing={accountQuery.isRefetching || pollsQuery.isRefetching}
      subtitle={`أهلًا بك، ${accountUser.name}. دورك الحالي: ${roleLabel(accountUser.role)}`}
      title="لوحة التحكم الموحدة"
    >
      {accountQuery.isError ? (
        <AppCard style={{ borderColor: theme.palette.danger }}>
          <AppText color="danger">
            تعذر تحميل بيانات اللوحة. يمكنك محاولة تحديثها.
          </AppText>
        </AppCard>
      ) : null}

      <View style={styles.tabs}>
        {capabilities.canViewSubmissions ? (
          <AppButton
            icon={
              <Bus
                color={
                  activeTab === 'submissions'
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground
                }
                size={18}
              />
            }
            onPress={() => setRequestedTab('submissions')}
            variant={activeTab === 'submissions' ? 'primary' : 'secondary'}
          >
            اقتراحاتي للخطوط
          </AppButton>
        ) : null}
        {capabilities.canManagePolls ? (
          <AppButton
            icon={
              <ListOrdered
                color={
                  activeTab === 'polls'
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground
                }
                size={18}
              />
            }
            onPress={() => setRequestedTab('polls')}
            variant={activeTab === 'polls' ? 'primary' : 'secondary'}
          >
            إدارة الاستبيانات
          </AppButton>
        ) : null}
        {capabilities.canReviewTransit ? (
          <AppButton
            icon={<Bus color={theme.palette.foreground} size={18} />}
            onPress={() => router.push('/transit/admin')}
            variant="secondary"
          >
            إدارة الترانزيت
          </AppButton>
        ) : null}
        {capabilities.canManagePolls ? (
          <AppButton
            icon={<MapPinned color={theme.palette.foreground} size={18} />}
            onPress={() => router.push('/admin/places')}
            variant="secondary"
          >
            مراجعة الأماكن والبلاغات
          </AppButton>
        ) : null}
        {canManageGovApps ? (
          <AppButton
            icon={<Settings color={theme.palette.foreground} size={18} />}
            onPress={() => router.push('/admin/govapps')}
            variant="secondary"
          >
            إدارة التطبيقات الحكومية
          </AppButton>
        ) : null}
        {canManagePhoneDirectory ? (
          <AppButton
            icon={<ListOrdered color={theme.palette.foreground} size={18} />}
            onPress={() => router.push('/admin/phonebook')}
            variant="secondary"
          >
            إدارة دليل الهاتف
          </AppButton>
        ) : null}
        {canManageOfficialDirectory ? (
          <AppButton
            icon={<Shield color={theme.palette.foreground} size={18} />}
            onPress={() => router.push('/admin/syofficial')}
            variant="secondary"
          >
            إدارة الحسابات الرسمية
          </AppButton>
        ) : null}
        <AppButton
          icon={
            <Settings
              color={
                activeTab === 'profile'
                  ? theme.palette.primaryForeground
                  : theme.palette.foreground
              }
              size={18}
            />
          }
          onPress={() => setRequestedTab('profile')}
          variant={activeTab === 'profile' ? 'primary' : 'secondary'}
        >
          إعدادات الحساب
        </AppButton>
      </View>

      {accountUser.role === 'superadmin' ? (
        <View style={styles.superadminActions}>
          <AppButton
            icon={<Shield color={theme.palette.foreground} size={18} />}
            onPress={() => router.push('/admin/users')}
            variant="secondary"
          >
            إدارة المستخدمين داخل التطبيق
          </AppButton>
          <AppButton
            icon={<Shield color={theme.palette.primaryForeground} size={18} />}
            onPress={() => void Linking.openURL(`${apiOrigin}/superadmin`)}
            variant="danger"
          >
            أدوات الإدارة المتقدمة على الويب
          </AppButton>
        </View>
      ) : null}

      {activeTab === 'submissions' && capabilities.canViewSubmissions ? (
        <View style={styles.section}>
          <AppText variant="heading">سجل اقتراحات المسارات الخاصة بك</AppText>
          {accountQuery.isPending ? <AppText color="muted">جار تحميل الاقتراحات...</AppText> : null}
          {!accountQuery.isPending && myDrafts.length === 0 ? (
            <QueryState detail="لم تقدم أي اقتراحات مسارات بعد." type="empty" />
          ) : null}
          {myDrafts.map((draft) => (
            <AppCard key={draft.id} style={styles.draftCard}>
              <View style={styles.row}>
                <AppText style={styles.grow} variant="heading">{draft.name_ar}</AppText>
                <AppText
                  color={
                    draft.status === 'approved'
                      ? 'success'
                      : draft.status === 'rejected'
                        ? 'danger'
                        : 'primary'
                  }
                  variant="caption"
                >
                  {draftStatusLabel(draft.status)}
                </AppText>
              </View>
              {draft.name_en ? <AppText color="muted" variant="caption">{draft.name_en}</AppText> : null}
              <AppText color="muted" variant="caption">
                المدينة: {draft.city?.name_ar ?? draft.city_id}، تاريخ التقديم: {new Date(draft.created_at).toLocaleDateString('ar-SY')}
              </AppText>
              {draft.route_id ? (
                <AppText color="primary" variant="caption">
                  تعديل مقترح لخط منشور
                </AppText>
              ) : null}
              {draft.status === 'rejected' && draft.rejection_reason ? (
                <AppText color="danger" variant="caption">
                  ملاحظات التدقيق: {draft.rejection_reason}
                </AppText>
              ) : null}
              <View style={styles.cardActions}>
                {draft.status === 'pending' ? (
                  <AppButton
                    loading={withdrawingDraftId === draft.id}
                    onPress={() => withdrawDraft(draft.id)}
                    variant="danger"
                  >
                    سحب الاقتراح
                  </AppButton>
                ) : null}
                <AppButton
                  accessibilityLabel={`تعديل ${draft.name_ar}`}
                  icon={<Edit color={theme.palette.foreground} size={18} />}
                  onPress={() =>
                    router.push({
                      params: { edit: String(draft.id) },
                      pathname: '/transit/studio',
                    })
                  }
                  variant="secondary"
                >
                  تعديل
                </AppButton>
                {draft.status === 'approved' && draft.route_id ? (
                  <AppButton
                    accessibilityLabel={`عرض ${draft.name_ar}`}
                    onPress={() =>
                      router.push({
                        params: {
                          id: draft.city_id,
                          routeId: draft.route_id,
                        },
                        pathname: '/transit/city/[id]/route/[routeId]',
                      })
                    }
                    variant="secondary"
                  >
                    عرض الخط المنشور
                  </AppButton>
                ) : null}
              </View>
            </AppCard>
          ))}
        </View>
      ) : null}

      {activeTab === 'polls' && capabilities.canManagePolls ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <AppText style={styles.grow} variant="heading">إدارة استبيانات التقييم</AppText>
            <AppButton
              icon={<Plus color={theme.palette.primaryForeground} size={18} />}
              onPress={() => setMode('poll-create')}
            >
              إنشاء استبيان جديد
            </AppButton>
          </View>
          {pollsQuery.isError ? (
            <QueryState
              detail="تعذر تحميل الاستبيانات."
              onRetry={() => void pollsQuery.refetch()}
              type="error"
            />
          ) : null}
          {pollsQuery.isPending ? <AppText color="muted">جار تحميل الاستبيانات...</AppText> : null}
          {pollsQuery.data?.length === 0 ? (
            <QueryState detail="لا توجد استبيانات مسجلة حاليًا." type="empty" />
          ) : null}
          {pollsQuery.data?.map((poll) => (
            <AppCard key={poll.id} style={styles.pollCard}>
              <View style={styles.grow}>
                <AppText variant="label">{poll.title}</AppText>
                <AppText color="muted" style={styles.ltr} variant="caption">{poll.slug}</AppText>
                <AppText color="muted" variant="caption">
                  {poll.candidatesCount.toLocaleString('ar-SY')} مرشحًا، {poll.isActive ? 'نشط' : 'معطل'}
                </AppText>
              </View>
              <View style={styles.cardActions}>
                <AppButton
                  icon={<Edit color={theme.palette.foreground} size={17} />}
                  onPress={() => {
                    setEditingPollId(poll.id);
                    setMode('poll-edit');
                  }}
                  variant="secondary"
                >
                  تعديل
                </AppButton>
                {poll.slug === 'best-ministers' ? (
                  <AppButton
                    disabled
                    icon={<Ban color={theme.palette.mutedForeground} size={17} />}
                    variant="ghost"
                  >
                    محمي
                  </AppButton>
                ) : (
                  <AppButton
                    disabled={deletingPollId === poll.id}
                    icon={<Trash2 color={theme.palette.danger} size={17} />}
                    onPress={() => confirmPollDeletion(poll)}
                    variant="danger"
                  >
                    حذف
                  </AppButton>
                )}
              </View>
            </AppCard>
          ))}
        </View>
      ) : null}

      {activeTab === 'profile' ? (
        <View style={styles.section}>
          <AppText variant="heading">إعدادات الحساب الشخصي</AppText>
          {profileMessage ? (
            <AppCard
              style={{
                borderColor:
                  profileMessage.type === 'success'
                    ? theme.palette.success
                    : theme.palette.danger,
              }}
            >
              <AppText color={profileMessage.type === 'success' ? 'success' : 'danger'}>
                {profileMessage.text}
              </AppText>
            </AppCard>
          ) : null}
          <AppCard style={styles.form}>
            <View style={styles.avatarRow}>
              <Avatar
                label={accountUser.name}
                size={88}
                uri={accountUser.avatar_url}
              />
              <View style={styles.grow}>
                <AppText variant="label">صورة الحساب</AppText>
                <AppText color="muted" variant="caption">
                  صورة مربعة بصيغة JPEG أو PNG أو WebP، وبحجم أقصى 4 MB.
                </AppText>
                <AppButton
                  icon={<Camera color={theme.palette.foreground} size={18} />}
                  loading={avatarLoading}
                  onPress={() => void pickAvatar()}
                  testID="dashboard-avatar-picker"
                  variant="secondary"
                >
                  اختيار صورة جديدة
                </AppButton>
              </View>
            </View>
            <AppText variant="label">اسم المستخدم</AppText>
            <AppInput
              maxLength={255}
              onChangeText={setProfileName}
              testID="dashboard-profile-name"
              value={profileName}
            />
            <AppText variant="label">البريد الإلكتروني</AppText>
            <AppInput
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={255}
              onChangeText={setProfileEmail}
              testID="dashboard-profile-email"
              textAlign="left"
              value={profileEmail}
            />
            <AppButton
              loading={profileLoading}
              onPress={() => void updateProfile()}
              testID="dashboard-profile-save"
            >
              حفظ التعديلات
            </AppButton>
          </AppCard>
          <AppCard style={[styles.dangerZone, { borderColor: theme.palette.danger }]}>
            <View style={styles.row}>
              <AlertCircle color={theme.palette.danger} size={24} />
              <AppText color="danger" variant="heading">منطقة الخطر: حذف الحساب نهائيًا</AppText>
            </View>
            <AppText color="muted">
              حذف حسابك سيمسح هويتك من المنصة. لن تحذف اقتراحات النقل أو الاستبيانات التي أنشأتها. ستفوض لحساب الإدارة العامة لحفظ الأرشيف العام.
            </AppText>
            <AppButton
              icon={<Trash2 color={theme.palette.primaryForeground} size={18} />}
              loading={deleteLoading}
              onPress={confirmAccountDeletion}
              testID="dashboard-account-delete"
              variant="danger"
            >
              حذف الحساب نهائيًا
            </AppButton>
          </AppCard>
        </View>
      ) : null}
    </Screen>
  );
}

export default function Dashboard() {
  const { loading, login, logout, refreshUser, user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const initialTab = dashboardTabFromParam(params.tab);

  if (loading) {
    return (
      <Screen title="لوحة التحكم الموحدة">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="لوحة التحكم الموحدة">
        <QueryState detail="سجل الدخول للوصول إلى مشاركاتك وإعدادات حسابك." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }

  return (
    <DashboardContent
      initialTab={initialTab}
      key={user.id}
      logout={logout}
      refreshUser={refreshUser}
      user={user}
    />
  );
}

const styles = StyleSheet.create({
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 14,
  },
  cardActions: {
    gap: 7,
  },
  dangerZone: {
    gap: 12,
  },
  draftCard: {
    gap: 7,
  },
  form: {
    gap: 12,
  },
  grow: {
    flex: 1,
    minWidth: 140,
  },
  ltr: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  pollCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 9,
  },
  section: {
    gap: 14,
  },
  superadminActions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabs: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Dashboard/Index.tsx (720 lines)
  confidence: high
  todos:      0
  notes:      Native role gates, linked route journeys, poll administration, resilient avatars, profile updates, and account deletion preserve the source dashboard.
*/
