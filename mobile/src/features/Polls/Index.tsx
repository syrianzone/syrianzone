import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { fetchPolls, pollQueryKeys } from '@/lib/api/polls';

import PollLeaderboard from './Leaderboard';
import PollShow from './Show';

export default function PollsIndex() {
  const [selected, setSelected] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState(false);
  const query = useQuery({ queryFn: ({ signal }) => fetchPolls({ signal }), queryKey: pollQueryKeys.all });
  if (selected) {
    return leaderboard
      ? <PollLeaderboard identifier={selected} onBack={() => setLeaderboard(false)} onVote={() => setLeaderboard(false)} />
      : <PollShow identifier={selected} onBack={() => setSelected(null)} onLeaderboard={() => setLeaderboard(true)} />;
  }
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching} subtitle="شارك وتابع النتائج المجتمعية" title="الاستبيانات واستطلاعات الرأي">
      {query.isError ? <QueryState detail="تعذر تحميل الاستطلاعات." onRetry={() => void query.refetch()} type="error" /> : null}
      {query.data?.length === 0 ? <QueryState detail="لا توجد استطلاعات متاحة حاليًا." type="empty" /> : null}
      {query.data?.map((poll) => (
        <Pressable key={poll.id} onPress={() => setSelected(poll.slug)}>
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
  notes:      Native list navigation preserves poll selection, status, voting, and leaderboard access.
*/
