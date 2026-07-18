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
  canReviewTransit,
  type DraftStatusFilter,
  filterTransitDrafts,
  transitDraftStats,
  transitDraftStopCount,
} from './model';

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

export default function TransitAdminScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const permitted = canReviewTransit(user?.role);
  const [statusFilter, setStatusFilter] = useState<DraftStatusFilter>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitterBanStates, setSubmitterBanStates] = useState<
    Readonly<Record<number, boolean>>
  >({});
  const draftsQuery = useQuery({
    enabled: permitted,
    queryFn: getTransitDrafts,
    queryKey: ['transit-admin-drafts'],
  });
  const drafts = useMemo(() => draftsQuery.data ?? [], [draftsQuery.data]);
  const selected = drafts.find((draft) => draft.id === selectedId) ?? null;
  const reference = useMapData(selected?.city_id);
  const selectedCity =
    (cities as unknown as readonly City[]).find(
      (city) => city.id === selected?.city_id,
    ) ??
    fallbackCity;
  const preview = selected
    ? buildDraftMapData(selected, reference.data)
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
    mutationFn: approveTransitDraft,
    onSuccess: async () => {
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['transit-admin-drafts'] });
    },
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      rejectTransitDraft(id, reason),
    onSuccess: async () => {
      setRejectReason('');
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['transit-admin-drafts'] });
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
        <QueryState detail="سجل الدخول للوصول إلى مراجعة المسارات." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="لوحة إدارة الترانزيت">
        <QueryState detail="لا يملك هذا الحساب صلاحية مراجعة المسارات." type="error" />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={() => void draftsQuery.refetch()}
      refreshing={draftsQuery.isRefetching}
      subtitle="مراجعة مسارات المجتمع"
      title="لوحة إدارة الترانزيت"
    >
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
            accessibilityRole="button"
            key={draft.id}
            onPress={() => setSelectedId(draft.id)}
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
              <AppButton
                icon={<CheckCircle2 color={theme.palette.primaryForeground} size={18} />}
                loading={approve.isPending}
                onPress={() => approve.mutate(selected.id)}
              >
                موافقة ونشر
              </AppButton>
              <AppInput
                maxLength={1_000}
                multiline
                onChangeText={setRejectReason}
                placeholder="سبب الرفض (اختياري)"
                value={rejectReason}
              />
              <AppButton
                icon={<XCircle color={theme.palette.primaryForeground} size={18} />}
                loading={reject.isPending}
                onPress={() => reject.mutate({ id: selected.id, reason: rejectReason })}
                variant="danger"
              >
                تأكيد الرفض
              </AppButton>
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
    </Screen>
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
  source:     resources/js/Pages/Transit/admin/Index.tsx (821 lines)
  confidence: high
  todos:      0
  notes:      Bearer role gates, filters, preview, moderation, decisions, counts, and refresh preserve native review behavior.
*/
