import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { fetchPolls, pollQueryKeys } from '@/lib/api/polls';

import { openPoll } from './navigation';

export default function PollsIndex() {
  const query = useQuery({ queryFn: ({ signal }) => fetchPolls({ signal }), queryKey: pollQueryKeys.all });
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching} subtitle="شارك وتابع النتائج المجتمعية" title="الاستبيانات واستطلاعات الرأي">
      {query.isError ? <QueryState detail="تعذر تحميل الاستطلاعات." onRetry={() => void query.refetch()} type="error" /> : null}
      {query.data?.length === 0 ? <QueryState detail="لا توجد استطلاعات متاحة حاليًا." type="empty" /> : null}
      {query.data?.map((poll) => (
        <Pressable key={poll.id} onPress={() => openPoll(poll.slug)}>
          <AppCard style={styles.card}>
            <AppText variant="heading">{poll.title}</AppText>
            <AppText color={poll.isActive ? 'default' : 'muted'}>{poll.isActive ? 'نشط' : 'مغلق'}</AppText>
          </AppCard>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { gap: 8 } });

/*
PORT STATUS
  source:     resources/js/Pages/Polls/Index.tsx (68 lines)
  confidence: high
  todos:      0
  notes:      Each poll opens its own /polls/[slug] route, so Android back and deep links behave like the website URLs.
*/
