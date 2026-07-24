import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPin, ShieldAlert, XCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import type { AuthUser } from '@/lib/auth/types';

import { TransitMapView } from '../_components/citymap/MapView';
import cities from '../_data/cities';
import { useMapData } from '../_hooks/useMapData';
import type { City } from '../_types';
import {
  approveTransitDraft,
  getTransitDrafts,
  rejectTransitDraft,
  toggleTransitSubmitterBan,
} from '../api';
import {
  buildDraftMapData,
  type DraftStatusFilter,
  filterTransitDrafts,
  transitAdminAccess,
  type TransitAdminAccess,
  transitAdminDraftsQueryKey,
  transitDraftStats,
  transitDraftStopCount,
} from './model';
import { PublishedRoutesPanel } from './PublishedRoutesPanel';
import { RouteColorSelector } from './RouteColorSelector';

const statusLabels = {
  all: 'الكل',
  approved: 'مقبول',
  pending: 'قيد الانتظار',
  rejected: 'مرفوض',
} as const;

const fallbackCity: City = {
  bounds: null,
  center: [36.29, 33.51],
  id: 'damascus',
  nameAr: 'دمشق',
  nameEn: 'Damascus',
  routeCount: 0,
  status: 'active',
  zoom: 11,
};

interface SubmitterBanConfirmation {
  id: number;
  isBanned: boolean;
  onConfirm: (input: { id: number; isBanned: boolean }) => void;
}

export function confirmTransitSubmitterBan({
  id,
  isBanned,
  onConfirm,
}: SubmitterBanConfirmation): void {
  const nextState = !isBanned;
  Alert.alert(
    nextState ? 'حظر المساهم؟' : 'إلغاء حظر المساهم؟',
    nextState
      ? 'سيتم منع هذا الحساب من إرسال مسارات جديدة وسحب جلساته الحالية.'
      : 'سيتمكن هذا الحساب من إرسال مسارات جديدة بعد تسجيل الدخول مجددًا.',
    [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => onConfirm({ id, isBanned: nextState }),
        style: nextState ? 'destructive' : 'default',
        text: nextState ? 'حظر' : 'إلغاء الحظر',
      },
    ],
  );
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface TransitAdminWorkspaceProps {
  access: TransitAdminAccess;
  user: AuthUser;
}

function TransitAdminWorkspace({
  access,
  user,
}: TransitAdminWorkspaceProps) {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DraftStatusFilter>('all');
  const [requestedAdminView, setRequestedAdminView] = useState<
    'drafts' | 'routes'
  >(access.canManageDrafts ? 'drafts' : 'routes');
  const [cityFilter, setCityFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [approveColorIndex, setApproveColorIndex] = useState(0);
  const [approveDraftId, setApproveDraftId] = useState('');
  const [rejectDraftId, setRejectDraftId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitterBanStates, setSubmitterBanStates] = useState<
    Readonly<Record<number, boolean>>
  >({});
  const adminView =
    requestedAdminView === 'drafts' && access.canManageDrafts
      ? 'drafts'
      : requestedAdminView === 'routes' && access.canManagePublishedRoutes
        ? 'routes'
        : access.canManageDrafts
          ? 'drafts'
          : 'routes';
  const draftsQuery = useQuery({
    enabled: access.reviewDrafts,
    queryFn: getTransitDrafts,
    queryKey: transitAdminDraftsQueryKey(user.id),
  });
  const drafts = useMemo(
    () => (access.reviewDrafts ? draftsQuery.data ?? [] : []),
    [access.reviewDrafts, draftsQuery.data],
  );
  const selected = drafts.find((draft) => draft.id === selectedId) ?? null;
  const reference = useMapData(selected?.city_id);
  const selectedCity =
    (cities as unknown as readonly City[]).find(
      (city) => city.id === selected?.city_id,
    ) ??
    fallbackCity;
  const preview = selected
    ? buildDraftMapData(selected, reference.data, approveColorIndex)
    : null;
  const selectedSubmitterId = selected?.user?.id ?? selected?.user_id ?? null;
  const selectedSubmitterBanned = selectedSubmitterId === null
    ? false
    : submitterBanStates[selectedSubmitterId] ?? selected?.user?.is_banned ?? false;
  const stats = transitDraftStats(drafts);
  const cityIds = useMemo(
    () => [...new Set(drafts.map((draft) => draft.city_id))].sort(),
    [drafts],
  );
  const filtered = useMemo(
    () => filterTransitDrafts(drafts, statusFilter, cityFilter),
    [cityFilter, drafts, statusFilter],
  );

  const approve = useMutation({
    mutationFn: ({
      colorIndex,
      id,
    }: {
      colorIndex: number;
      id: number;
    }) => approveTransitDraft(id, colorIndex),
    onSuccess: async () => {
      setApproveColorIndex(0);
      setApproveDraftId('');
      setSelectedId(null);
      await queryClient.invalidateQueries({
        queryKey: transitAdminDraftsQueryKey(user.id),
      });
    },
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      rejectTransitDraft(id, reason),
    onSuccess: async () => {
      setRejectDraftId('');
      setRejectReason('');
      setSelectedId(null);
      await queryClient.invalidateQueries({
        queryKey: transitAdminDraftsQueryKey(user.id),
      });
    },
  });
  const toggleSubmitterBan = useMutation({
    mutationFn: ({ id, isBanned }: { id: number; isBanned: boolean }) =>
      toggleTransitSubmitterBan(id, isBanned),
    onSuccess: (submitter) => {
      setSubmitterBanStates((current) => ({
        ...current,
        [submitter.id]: submitter.is_banned,
      }));
    },
  });

  const confirmSubmitterBanToggle = () => {
    if (selectedSubmitterId === null || !selected?.user) {
      return;
    }
    confirmTransitSubmitterBan({
      id: selectedSubmitterId,
      isBanned: selectedSubmitterBanned,
      onConfirm: (input) => toggleSubmitterBan.mutate(input),
    });
  };

  return (
    <Screen
      onRefresh={
        adminView === 'drafts' && access.reviewDrafts
          ? () => void draftsQuery.refetch()
          : undefined
      }
      refreshing={
        adminView === 'drafts' &&
        access.reviewDrafts &&
        draftsQuery.isRefetching
      }
      subtitle="إدارة مسارات المجتمع"
      title="لوحة إدارة الترانزيت"
    >
      <View style={styles.filters}>
        {access.canManageDrafts ? (
          <AppButton
            onPress={() => setRequestedAdminView('drafts')}
            variant={adminView === 'drafts' ? 'primary' : 'secondary'}
          >
            مراجعة المقترحات
          </AppButton>
        ) : null}
        {access.canManagePublishedRoutes ? (
          <AppButton
            onPress={() => setRequestedAdminView('routes')}
            variant={adminView === 'routes' ? 'primary' : 'secondary'}
          >
            إدارة الخطوط المنشورة
          </AppButton>
        ) : null}
      </View>
      {adminView === 'routes' ? (
        <PublishedRoutesPanel
          access={access}
          accountId={user.id}
          cities={cities as unknown as readonly City[]}
        />
      ) : (
        <>
      {access.reviewDrafts ? (
        <>
      <View style={styles.stats}>
        <AppCard style={styles.stat}>
          <AppText color="primary" variant="heading">{stats.pending}</AppText>
          <AppText color="muted" variant="caption">بانتظار المراجعة</AppText>
        </AppCard>
        <AppCard style={styles.stat}>
          <AppText color="success" variant="heading">{stats.approved}</AppText>
          <AppText color="muted" variant="caption">مقبول</AppText>
        </AppCard>
        <AppCard style={styles.stat}>
          <AppText color="danger" variant="heading">{stats.rejected}</AppText>
          <AppText color="muted" variant="caption">مرفوض</AppText>
        </AppCard>
      </View>

      <View style={styles.filters}>
        {(Object.keys(statusLabels) as DraftStatusFilter[]).map((status) => (
          <AppButton
            key={status}
            onPress={() => setStatusFilter(status)}
            variant={statusFilter === status ? 'primary' : 'secondary'}
          >
            {statusLabels[status]}
          </AppButton>
        ))}
      </View>
      {cityIds.length > 1 ? (
        <View style={styles.filters}>
          <AppButton
            onPress={() => setCityFilter('all')}
            variant={cityFilter === 'all' ? 'primary' : 'secondary'}
          >
            جميع المدن
          </AppButton>
          {cityIds.map((cityId) => (
            <AppButton
              key={cityId}
              onPress={() => setCityFilter(cityId)}
              variant={cityFilter === cityId ? 'primary' : 'secondary'}
            >
              {cityId}
            </AppButton>
          ))}
        </View>
      ) : null}

      {draftsQuery.isError ? (
        <QueryState onRetry={() => void draftsQuery.refetch()} type="error" />
      ) : draftsQuery.isLoading ? (
        <AppText color="muted">جار تحميل المسارات...</AppText>
      ) : filtered.length === 0 ? (
        <QueryState type="empty" />
      ) : (
        filtered.map((draft) => (
          <Pressable
            accessibilityLabel={`مراجعة ${draft.name_ar}`}
            accessibilityRole="button"
            key={draft.id}
            onPress={() => {
              setApproveColorIndex(0);
              setSelectedId(draft.id);
            }}
          >
            <AppCard
              style={[
                styles.draft,
                {
                  borderColor:
                    selectedId === draft.id
                      ? theme.palette.primary
                      : theme.palette.border,
                },
              ]}
            >
              <View style={styles.draftTitle}>
                <AppText style={styles.grow} variant="heading">{draft.name_ar}</AppText>
                <AppText
                  color={
                    draft.status === 'approved'
                      ? 'success'
                      : draft.status === 'rejected'
                        ? 'danger'
                        : 'primary'
                  }
                  variant="label"
                >
                  {statusLabels[draft.status]}
                </AppText>
              </View>
              <AppText color="muted" variant="caption">
                {draft.city?.name_ar ?? draft.city_id}، {draft.user?.name ?? 'مجهول'}،{' '}
                {transitDraftStopCount(draft)} محطة
              </AppText>
              <AppText color="muted" variant="caption">
                {new Date(draft.created_at).toLocaleDateString('ar-SY')}
              </AppText>
              {draft.rejection_reason ? (
                <AppText color="danger" variant="caption">{draft.rejection_reason}</AppText>
              ) : null}
            </AppCard>
          </Pressable>
        ))
      )}
        </>
      ) : null}

      {selected && preview ? (
        <AppCard style={styles.detail}>
          <View style={styles.draftTitle}>
            <MapPin color={theme.palette.primary} size={24} />
            <AppText style={styles.grow} variant="heading">{selected.name_ar}</AppText>
          </View>
          {selected.name_en ? <AppText color="muted">{selected.name_en}</AppText> : null}
          <AppText>
            {selected.price ? `${selected.price.toLocaleString('ar-SY')} ل.س` : 'التعرفة غير محددة'}
          </AppText>
          {selected.notes ? <AppText color="muted">{selected.notes}</AppText> : null}
          <AppText color="muted" variant="caption">
            تعرض الخريطة البيانات المنشورة مع المسار المقترح والمحطات بالترتيب.
          </AppText>
          <View style={styles.map}>
            <TransitMapView city={selectedCity} data={preview} />
          </View>
          {selected.user && selectedSubmitterId !== null ? (
            <View style={styles.submitter}>
              <View style={styles.grow}>
                <AppText variant="label">المساهم: {selected.user.name}</AppText>
                <AppText
                  color={selectedSubmitterBanned ? 'danger' : 'muted'}
                  variant="caption"
                >
                  {selectedSubmitterBanned ? 'الحساب محظور' : 'الحساب مسموح له بالمساهمة'}
                </AppText>
              </View>
              <AppButton
                loading={
                  toggleSubmitterBan.isPending &&
                  toggleSubmitterBan.variables?.id === selectedSubmitterId
                }
                onPress={confirmSubmitterBanToggle}
                variant={selectedSubmitterBanned ? 'secondary' : 'danger'}
              >
                {selectedSubmitterBanned ? 'إلغاء حظر المساهم' : 'حظر المساهم'}
              </AppButton>
            </View>
          ) : (
            <AppText color="muted" variant="caption">
              هذا الاقتراح مجهول ولا يرتبط بحساب يمكن حظره.
            </AppText>
          )}
          {selected.status === 'pending' ? (
            <>
              {access.approve ? (
                <>
                  <RouteColorSelector
                    onChange={setApproveColorIndex}
                    value={approveColorIndex}
                  />
                  <AppButton
                    icon={
                      <CheckCircle2
                        color={theme.palette.primaryForeground}
                        size={18}
                      />
                    }
                    loading={approve.isPending}
                    onPress={() =>
                      approve.mutate({
                        colorIndex: approveColorIndex,
                        id: selected.id,
                      })
                    }
                  >
                    موافقة ونشر
                  </AppButton>
                </>
              ) : null}
              {access.reject ? (
                <>
                  <AppInput
                    maxLength={1_000}
                    multiline
                    onChangeText={setRejectReason}
                    placeholder="سبب الرفض (اختياري)"
                    value={rejectReason}
                  />
                  <AppButton
                    icon={
                      <XCircle
                        color={theme.palette.primaryForeground}
                        size={18}
                      />
                    }
                    loading={reject.isPending}
                    onPress={() =>
                      reject.mutate({
                        id: selected.id,
                        reason: rejectReason,
                      })
                    }
                    variant="danger"
                  >
                    تأكيد الرفض
                  </AppButton>
                </>
              ) : null}
              {!access.approve && !access.reject ? (
                <AppText color="muted">
                  يمكنك مراجعة المقترح، لكن لا تملك صلاحية اتخاذ قرار بشأنه.
                </AppText>
              ) : null}
            </>
          ) : (
            <View style={styles.resolved}>
              <ShieldAlert color={theme.palette.mutedForeground} size={20} />
              <AppText color="muted">
                {selected.status === 'approved' ? 'تم نشر هذا المسار.' : 'تم رفض هذا المسار.'}
              </AppText>
            </View>
          )}
          {approve.isError || reject.isError || toggleSubmitterBan.isError ? (
            <AppText color="danger">تعذر حفظ القرار. حاول مرة أخرى.</AppText>
          ) : null}
        </AppCard>
      ) : null}
      {!access.reviewDrafts && access.approve ? (
        <AppCard style={styles.detail}>
          <AppText variant="heading">الموافقة على مقترح بالمعرف</AppText>
          <AppText color="muted">
            أدخل معرف المقترح الذي حصلت عليه من فريق المراجعة.
          </AppText>
          <AppInput
            keyboardType="number-pad"
            onChangeText={setApproveDraftId}
            placeholder="معرف المقترح للموافقة"
            value={approveDraftId}
          />
          <RouteColorSelector
            onChange={setApproveColorIndex}
            value={approveColorIndex}
          />
          <AppButton
            disabled={positiveInteger(approveDraftId) === null}
            icon={
              <CheckCircle2
                color={theme.palette.primaryForeground}
                size={18}
              />
            }
            loading={approve.isPending}
            onPress={() => {
              const id = positiveInteger(approveDraftId);
              if (id !== null) {
                approve.mutate({ colorIndex: approveColorIndex, id });
              }
            }}
          >
            موافقة ونشر
          </AppButton>
          {approve.isError ? (
            <AppText color="danger">تعذر حفظ القرار. حاول مرة أخرى.</AppText>
          ) : null}
        </AppCard>
      ) : null}
      {!access.reviewDrafts && access.reject ? (
        <AppCard style={styles.detail}>
          <AppText variant="heading">رفض مقترح بالمعرف</AppText>
          <AppText color="muted">
            أدخل معرف المقترح الذي حصلت عليه من فريق المراجعة.
          </AppText>
          <AppInput
            keyboardType="number-pad"
            onChangeText={setRejectDraftId}
            placeholder="معرف المقترح للرفض"
            value={rejectDraftId}
          />
          <AppInput
            maxLength={1_000}
            multiline
            onChangeText={setRejectReason}
            placeholder="سبب الرفض (اختياري)"
            value={rejectReason}
          />
          <AppButton
            disabled={positiveInteger(rejectDraftId) === null}
            icon={
              <XCircle
                color={theme.palette.primaryForeground}
                size={18}
              />
            }
            loading={reject.isPending}
            onPress={() => {
              const id = positiveInteger(rejectDraftId);
              if (id !== null) {
                reject.mutate({ id, reason: rejectReason });
              }
            }}
            variant="danger"
          >
            تأكيد الرفض
          </AppButton>
          {reject.isError ? (
            <AppText color="danger">تعذر حفظ القرار. حاول مرة أخرى.</AppText>
          ) : null}
        </AppCard>
      ) : null}
        </>
      )}
    </Screen>
  );
}

export default function TransitAdminScreen() {
  const { loading: authLoading, login, user } = useAuth();

  if (authLoading) {
    return (
      <Screen title="لوحة إدارة الترانزيت">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="لوحة إدارة الترانزيت">
        <QueryState
          detail="سجل الدخول للوصول إلى إدارة المسارات."
          type="error"
        />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }

  const access = transitAdminAccess(user);
  if (!access.canAccess) {
    return (
      <Screen title="لوحة إدارة الترانزيت">
        <QueryState
          detail="لا يملك هذا الحساب صلاحية إدارة الترانزيت."
          type="error"
        />
      </Screen>
    );
  }

  const workspaceKey = [
    user.id,
    user.role,
    user.is_banned ? 'banned' : 'active',
    [...(user.permissions ?? [])].sort().join(','),
  ].join(':');

  return (
    <TransitAdminWorkspace access={access} key={workspaceKey} user={user} />
  );
}

const styles = StyleSheet.create({
  detail: {
    gap: 12,
  },
  draft: {
    gap: 6,
  },
  draftTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  map: {
    height: 360,
    overflow: 'hidden',
  },
  resolved: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  submitter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/admin/Index.tsx (978 lines)
  confidence: high
  todos:      0
  notes:      Bearer role gates cover proposal review plus full published-route administration and activity history.
*/
