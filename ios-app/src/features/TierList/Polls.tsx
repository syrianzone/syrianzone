import { useCallback } from 'react';
import { FlatList } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, RequestStatus, Row } from '../../components';
import { useResource } from '../../resource';
import { NativeAction } from '../../ui/native';
import { useAccount, useCan } from '../../platform/account';
import { useFeatureNavigation } from '../../platform/features';
import { decodePollsPage } from './model';

export function PollCatalogue(): React.JSX.Element {
  const account = useAccount(); const navigation = useFeatureNavigation(); const canCreate = useCan('polls.create'); const canEdit = useCan('polls.edit'); const canDelete = useCan('polls.delete');
  const resource = useResource(useCallback(signal => api.page('/polls', 'Polls/Index', decodePollsPage, { signal, authenticated: Boolean(account.user), sessionGeneration: account.sessionGeneration }), [account.user, account.sessionGeneration]));
  return <AdaptivePanes primary={<FlatList data={resource.data ?? []} keyExtractor={poll => poll.id} contentContainerStyle={contentStyle}
    ListHeaderComponent={<><Heading>الاستبيانات واستطلاعات الرأي</Heading><RequestStatus resource={resource} />{canCreate || canEdit || canDelete ? <NativeAction title="إدارة الاستبيانات" systemImage="slider.horizontal.3" onPress={() => navigation.open('dashboard', { tab: 'polls' })} /> : null}</>}
    renderItem={({ item }) => <Row title={item.title} subtitle={item.active ? 'نشط' : 'مغلق'} onPress={() => navigation.open('tierlist', { poll: item.slug })} />}
    ListEmptyComponent={!resource.loading ? <EmptyState title="لا توجد استطلاعات رأي نشطة حالياً" /> : <></>} />} />;
}
// PORT STATUS: source resources/js/Pages/Polls/Index.tsx; confidence medium; todos 0.
