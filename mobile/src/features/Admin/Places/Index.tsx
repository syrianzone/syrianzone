import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORY_LABELS } from '@/features/Places/_lib/categories';
import { placesApi } from '@/features/Places/_lib/api';
import type {
  AdminPlace,
  PlaceReport,
} from '@/features/Places/_lib/types';

import {
  canModeratePlaces,
  type PlaceModerationStatus,
  placeModerationStatusLabel,
  type ReportModerationStatus,
  reportModerationStatusLabel,
} from './model';

type ModerationTab = 'places' | 'reports';

const placeStatuses: readonly PlaceModerationStatus[] = [
  'pending',
  'approved',
  'rejected',
  'all',
];
const reportStatuses: readonly ReportModerationStatus[] = [
  'open',
  'resolved',
  'dismissed',
  'all',
];

function PlaceReviewCard({
  busy,
  onApprove,
  onDelete,
  onReject,
  place,
}: {
  busy: boolean;
  onApprove: () => void;
  onDelete: () => void;
  onReject: (reason: string | null) => void;
  place: AdminPlace;
}) {
  const [reason, setReason] = useState(place.rejection_reason ?? '');
  return (
    <AppCard style={styles.card}>
      {place.photos[0] ? (
        <Image
          accessibilityLabel={place.name}
          contentFit="cover"
          source={{ uri: place.photos[0].display_url }}
          style={styles.image}
        />
      ) : null}
      <View style={styles.headingRow}>
        <View style={styles.grow}>
          <AppText variant="heading">{place.name}</AppText>
          <AppText color="muted" variant="caption">
            {CATEGORY_LABELS[place.category]}، أضافه {place.user.name}
          </AppText>
        </View>
        <AppText
          color={
            place.status === 'approved'
              ? 'success'
              : place.status === 'rejected'
                ? 'danger'
                : 'primary'
          }
          variant="label"
        >
          {placeModerationStatusLabel(place.status)}
        </AppText>
      </View>
      <AppText>{place.description}</AppText>
      <AppText color="muted" variant="caption">
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}،{' '}
        {place.reports_count.toLocaleString('ar-SY')} بلاغ
      </AppText>
      {place.status === 'pending' ? (
        <>
          <AppInput
            multiline
            onChangeText={setReason}
            placeholder="سبب الرفض، اختياري"
            value={reason}
          />
          <View style={styles.actions}>
            <AppButton disabled={busy} onPress={onApprove}>
              قبول ونشر
            </AppButton>
            <AppButton
              disabled={busy}
              onPress={() => onReject(reason.trim() || null)}
              variant="danger"
            >
              رفض
            </AppButton>
          </View>
        </>
      ) : null}
      <AppButton disabled={busy} onPress={onDelete} variant="danger">
        حذف نهائي
      </AppButton>
    </AppCard>
  );
}

function ReportCard({
  busy,
  onDismiss,
  onResolve,
  report,
}: {
  busy: boolean;
  onDismiss: () => void;
  onResolve: () => void;
  report: PlaceReport;
}) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.grow}>
          <AppText variant="heading">{report.place.name}</AppText>
          <AppText color="muted" variant="caption">
            أرسله {report.user.name}، السبب: {report.reason}
          </AppText>
        </View>
        <AppText color={report.status === 'open' ? 'danger' : 'muted'}>
          {reportModerationStatusLabel(report.status)}
        </AppText>
      </View>
      {report.details ? <AppText>{report.details}</AppText> : null}
      {report.status === 'open' ? (
        <View style={styles.actions}>
          <AppButton disabled={busy} onPress={onResolve}>
            تمت المعالجة
          </AppButton>
          <AppButton disabled={busy} onPress={onDismiss} variant="secondary">
            رفض البلاغ
          </AppButton>
        </View>
      ) : null}
    </AppCard>
  );
}

export default function AdminPlacesScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const queryClient = useQueryClient();
  const permitted = canModeratePlaces(user?.role);
  const [tab, setTab] = useState<ModerationTab>('places');
  const [placeStatus, setPlaceStatus] =
    useState<PlaceModerationStatus>('pending');
  const [reportStatus, setReportStatus] =
    useState<ReportModerationStatus>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const placesQuery = useQuery({
    enabled: permitted && tab === 'places',
    queryFn: () => placesApi.adminListPlaces(placeStatus),
    queryKey: ['admin-places', placeStatus],
  });
  const reportsQuery = useQuery({
    enabled: permitted && tab === 'reports',
    queryFn: () => placesApi.adminListReports(reportStatus),
    queryKey: ['admin-place-reports', reportStatus],
  });

  const refreshPlaces = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-places'] });
  const refreshReports = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-place-reports'] });
  const approve = useMutation({
    mutationFn: placesApi.adminApprove,
    onSuccess: refreshPlaces,
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string | null }) =>
      placesApi.adminReject(id, reason),
    onSuccess: refreshPlaces,
  });
  const deletePlace = useMutation({
    mutationFn: placesApi.adminDeletePlace,
    onSuccess: async () => {
      await Promise.all([refreshPlaces(), refreshReports()]);
    },
  });
  const resolveReport = useMutation({
    mutationFn: ({
      action,
      id,
    }: {
      action: 'resolve' | 'dismiss';
      id: number;
    }) => placesApi.adminResolveReport(id, action),
    onSuccess: refreshReports,
  });

  if (authLoading) {
    return (
      <Screen title="مراجعة الأماكن">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="مراجعة الأماكن">
        <QueryState detail="سجل الدخول للوصول إلى المراجعة." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="مراجعة الأماكن">
        <QueryState detail="لا يملك هذا الحساب صلاحية مراجعة الأماكن." type="error" />
      </Screen>
    );
  }

  const run = async (key: string, operation: () => Promise<unknown>) => {
    setBusyId(key);
    try {
      await operation();
    } catch (cause) {
      Alert.alert(
        cause instanceof Error ? cause.message : 'تعذر إكمال عملية المراجعة.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (place: AdminPlace) => {
    Alert.alert('حذف المكان نهائيًا؟', `سيتم حذف ${place.name} وصوره وتفاعلاته.`, [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () =>
          void run(`place-${place.id}`, () =>
            deletePlace.mutateAsync(place.id),
          ),
        style: 'destructive',
        text: 'حذف',
      },
    ]);
  };

  const activeQuery = tab === 'places' ? placesQuery : reportsQuery;
  return (
    <Screen
      onRefresh={() => void activeQuery.refetch()}
      refreshing={activeQuery.isRefetching}
      subtitle="اعتماد المشاركات ومعالجة بلاغات المجتمع"
      title="مراجعة الأماكن"
    >
      <View style={styles.actions}>
        <AppButton
          onPress={() => setTab('places')}
          variant={tab === 'places' ? 'primary' : 'secondary'}
        >
          الأماكن
        </AppButton>
        <AppButton
          onPress={() => setTab('reports')}
          variant={tab === 'reports' ? 'primary' : 'secondary'}
        >
          البلاغات
        </AppButton>
      </View>

      {tab === 'places' ? (
        <>
          <View style={styles.actions}>
            {placeStatuses.map((status) => (
              <AppButton
                key={status}
                onPress={() => setPlaceStatus(status)}
                variant={placeStatus === status ? 'primary' : 'secondary'}
              >
                {placeModerationStatusLabel(status)}
              </AppButton>
            ))}
          </View>
          {placesQuery.isLoading ? (
            <AppText color="muted">جار تحميل المشاركات...</AppText>
          ) : placesQuery.isError ? (
            <QueryState onRetry={() => void placesQuery.refetch()} type="error" />
          ) : placesQuery.data?.data.length === 0 ? (
            <QueryState type="empty" />
          ) : (
            placesQuery.data?.data.map((place) => (
              <PlaceReviewCard
                busy={busyId === `place-${place.id}`}
                key={place.id}
                onApprove={() =>
                  void run(`place-${place.id}`, () =>
                    approve.mutateAsync(place.id),
                  )
                }
                onDelete={() => confirmDelete(place)}
                onReject={(reason) =>
                  void run(`place-${place.id}`, () =>
                    reject.mutateAsync({ id: place.id, reason }),
                  )
                }
                place={place}
              />
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.actions}>
            {reportStatuses.map((status) => (
              <AppButton
                key={status}
                onPress={() => setReportStatus(status)}
                variant={reportStatus === status ? 'primary' : 'secondary'}
              >
                {reportModerationStatusLabel(status)}
              </AppButton>
            ))}
          </View>
          {reportsQuery.isLoading ? (
            <AppText color="muted">جار تحميل البلاغات...</AppText>
          ) : reportsQuery.isError ? (
            <QueryState onRetry={() => void reportsQuery.refetch()} type="error" />
          ) : reportsQuery.data?.data.length === 0 ? (
            <QueryState type="empty" />
          ) : (
            reportsQuery.data?.data.map((report) => (
              <ReportCard
                busy={busyId === `report-${report.id}`}
                key={report.id}
                onDismiss={() =>
                  void run(`report-${report.id}`, () =>
                    resolveReport.mutateAsync({
                      action: 'dismiss',
                      id: report.id,
                    }),
                  )
                }
                onResolve={() =>
                  void run(`report-${report.id}`, () =>
                    resolveReport.mutateAsync({
                      action: 'resolve',
                      id: report.id,
                    }),
                  )
                }
                report={report}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    gap: 12,
  },
  grow: {
    flex: 1,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  image: {
    aspectRatio: 16 / 9,
    borderRadius: 12,
    width: '100%',
  },
});
