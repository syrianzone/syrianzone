import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Pencil } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { TierBoard } from '@/components/poll/TierBoard';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { fetchPoll, pollQueryKeys } from '@/lib/api/polls';

interface PollShowProps {
  identifier: string;
  onBack?: () => void;
  onEdit?: (pollId: string) => void;
  onLeaderboard?: () => void;
}

export default function PollShow({
  identifier,
  onBack,
  onEdit,
  onLeaderboard,
}: PollShowProps) {
  const { isAdmin } = useAuth();
  const { theme } = useAppTheme();
  const query = useQuery({
    queryFn: ({ signal }) => fetchPoll(identifier, { signal }),
    queryKey: pollQueryKeys.detail(identifier),
  });

  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isFetching && !query.isPending}
      title={query.data?.poll.title ?? 'الاستطلاع'}
      trailing={onBack ? (
        <AppButton
          accessibilityLabel="العودة إلى الاستطلاعات"
          icon={<ArrowRight color={theme.palette.foreground} size={18} />}
          onPress={onBack}
          variant="ghost"
        >
          رجوع
        </AppButton>
      ) : null}
    >
      {query.isPending ? (
        <View accessibilityLabel="جاري تحميل الاستطلاع" style={styles.loading}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
        </View>
      ) : null}
      {query.isError && !query.data ? (
        <QueryState
          detail="تعذر تحميل الاستطلاع. تحقق من اتصالك وحاول مرة أخرى."
          onRetry={() => void query.refetch()}
          type="error"
        />
      ) : null}
      {query.data ? (
        <>
          {query.isError ? (
            <AppCard>
              <AppText color="muted">يتم عرض آخر بيانات محفوظة.</AppText>
            </AppCard>
          ) : null}
          <View style={styles.actions}>
            {onLeaderboard ? (
              <AppButton
                icon={<BarChart3 color={theme.palette.foreground} size={18} />}
                onPress={onLeaderboard}
                variant="secondary"
              >
                النتائج والإحصائيات
              </AppButton>
            ) : null}
            {isAdmin && onEdit ? (
              <AppButton
                icon={<Pencil color={theme.palette.foreground} size={18} />}
                onPress={() => onEdit(query.data.poll.id)}
                variant="secondary"
              >
                تعديل الاستطلاع
              </AppButton>
            ) : null}
          </View>
          <TierBoard
            candidates={query.data.candidates}
            groups={query.data.groups}
            poll={query.data.poll}
            voteDay={query.data.voteDay}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 9,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Polls/Show.tsx (79 lines)
  confidence: high
  todos:      0
  notes:      React Query, native role gates, and TierBoard replace Inertia props and browser navigation.
*/
