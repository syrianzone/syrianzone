import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import type { Place } from '../../domain';
import { contentStyle, EmptyState, Heading, Label, Photo, RequestStatus, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation } from '../../platform/features';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { placesClient } from './api';
import { usePages } from './usePages';
import { ManagePlace, placeStatusLabels } from './Manage';
import type { OwnPlace } from './model';

export function CommunityPlaces({ kind, header }: { kind: 'saves' | 'mine'; header?: ReactNode }): React.JSX.Element {
  const account = useAccount(), navigation = useFeatureNavigation(), { colors } = useTheme();
  const generation = account.sessionGeneration;
  const resource = usePages<Place | OwnPlace>(useCallback((page: number, signal: AbortSignal) => kind === 'mine' ? placesClient.mine(page, generation, signal) : placesClient.saved(page, generation, signal), [kind, generation]), account.user !== null && account.ready && !account.busy);
  const [managing, setManaging] = useState<OwnPlace | null>(null), [error, setError] = useState<string | null>(null);
  if (!account.user) return <View style={contentStyle}>{header}<Label>سجّل الدخول لعرض {kind === 'mine' ? 'مساهماتك' : 'محفوظات حسابك'}.</Label><NativeAction title="تسجيل الدخول" disabled={!account.ready || account.busy} onPress={() => { void account.signIn().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول.')); }} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>;
  return <><FlatList data={resource.data?.items ?? []} keyExtractor={item => String(item.id)} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>{header}<Heading>{kind === 'mine' ? 'مساهماتي' : 'محفوظات الحساب'}</Heading><RequestStatus resource={resource} /></View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد أماكن" /> : undefined}
    ListFooterComponent={resource.data && resource.data.currentPage < resource.data.lastPage ? <NativeAction title="عرض المزيد" disabled={resource.loadingMore} onPress={resource.more} /> : undefined}
    renderItem={({ item }) => <Section><Photo url={item.thumbnail} label={item.name} height={160} /><Label style={{ fontWeight: '700' }}>{item.name}</Label><NativeAction title="تفاصيل المكان" onPress={() => navigation.open('place', { id: String(item.id) })} />{'status' in item ? <><Label secondary>{placeStatusLabels[item.status]}</Label>{item.rejectionReason ? <Label>{item.rejectionReason}</Label> : null}<NativeAction title="إدارة" onPress={() => setManaging(item)} /></> : null}</Section>} />{managing ? <ManagePlace key={`${managing.id}:${generation}`} place={managing} close={() => setManaging(null)} updated={resource.reload} /> : null}</>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/PlacesPanel.tsx MineTab and SavesTab; confidence medium; todos 1 native account list and management verification.
