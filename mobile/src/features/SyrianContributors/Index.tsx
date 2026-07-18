import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  Award,
  Calendar,
  CalendarDays,
  Code2,
  Clock,
  ExternalLink,
  Medal,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { apiOrigin } from '@/lib/env';

import { fetchContributors } from './api';
import {
  CONTRIBUTION_PERIODS,
  contributorInitials,
  githubProfileUrl,
  sortContributors,
  type ContributionMetric,
  type Contributor,
} from './model';

const periodIcons = {
  daily_contributions: Clock,
  monthly_contributions: CalendarDays,
  total_contributions: Users,
  yearly_contributions: Calendar,
} as const;

function ContributorAvatar({
  contributor,
  size,
}: {
  contributor: Contributor;
  size: number;
}) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  if (!contributor.avatar_url || failed) {
    return (
      <View
        accessibilityLabel={contributor.username}
        style={[
          styles.avatarFallback,
          {
            backgroundColor: theme.palette.surfaceRaised,
            borderColor: theme.palette.border,
            height: size,
            width: size,
          },
        ]}
      >
        <AppText variant="heading">
          {contributorInitials(contributor.username)}
        </AppText>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel={contributor.username}
      cachePolicy="memory-disk"
      contentFit="cover"
      onError={() => setFailed(true)}
      source={{ uri: contributor.avatar_url }}
      style={[
        styles.avatar,
        { borderColor: theme.palette.border, height: size, width: size },
      ]}
    />
  );
}

function ProfileButton({ contributor }: { contributor: Contributor }) {
  const { theme } = useAppTheme();
  return (
    <AppButton
      icon={<ExternalLink color={theme.palette.foreground} size={16} />}
      onPress={() => void Linking.openURL(githubProfileUrl(contributor.username))}
      variant="secondary"
    >
      زيارة الملف الشخصي
    </AppButton>
  );
}

function WinnerCard({
  contributor,
  metric,
}: {
  contributor: Contributor;
  metric: ContributionMetric;
}) {
  const { theme } = useAppTheme();
  return (
    <AppCard style={[styles.winner, { borderColor: '#eab308' }]}>
      <View style={styles.winnerAvatar}>
        <ContributorAvatar contributor={contributor} size={96} />
        <View style={styles.trophyBadge}>
          <Trophy color="#713f12" size={24} />
        </View>
      </View>
      <AppText style={styles.centerText} variant="heading">
        {contributor.username}
      </AppText>
      <View style={[styles.score, { backgroundColor: theme.palette.surfaceRaised }]}>
        <AppText color="primary" style={styles.centerText} variant="title">
          {contributor[metric].toLocaleString('ar-SY')}
        </AppText>
        <AppText color="muted" style={styles.centerText} variant="caption">
          🏆 المتصدر الأول
        </AppText>
      </View>
      <ProfileButton contributor={contributor} />
    </AppCard>
  );
}

function RankedContributor({
  contributor,
  metric,
  rank,
}: {
  contributor: Contributor;
  metric: ContributionMetric;
  rank: number;
}) {
  const { theme } = useAppTheme();
  const RankIcon = rank === 2 ? Medal : rank === 3 ? Award : null;
  return (
    <AppCard style={styles.rankCard}>
      <View style={styles.rankHeading}>
        <AppText color="muted" variant="heading">
          #{rank.toLocaleString('ar-SY')}
        </AppText>
        <ContributorAvatar contributor={contributor} size={56} />
        <View style={styles.grow}>
          <AppText variant="label">{contributor.username}</AppText>
          <AppText color="muted" variant="caption">
            {contributor[metric].toLocaleString('ar-SY')} مساهمة
          </AppText>
        </View>
        {RankIcon ? <RankIcon color={rank === 2 ? '#9ca3af' : '#b45309'} size={24} /> : null}
      </View>
      <AppButton
      icon={<Code2 color={theme.palette.foreground} size={17} />}
        onPress={() => void Linking.openURL(githubProfileUrl(contributor.username))}
        variant="ghost"
      >
        GitHub
      </AppButton>
    </AppCard>
  );
}

export default function SyrianContributorsPage() {
  const { theme } = useAppTheme();
  const [metric, setMetric] =
    useState<ContributionMetric>('total_contributions');
  const [showEagle, setShowEagle] = useState(false);
  const query = useQuery({
    queryFn: ({ signal }) => fetchContributors(signal),
    queryKey: ['syrian-contributors'],
    refetchInterval: 60 * 60 * 1_000,
    staleTime: 60 * 60 * 1_000,
  });
  const ranked = useMemo(
    () => sortContributors(query.data ?? [], metric),
    [metric, query.data],
  );
  const period = CONTRIBUTION_PERIODS.find((item) => item.metric === metric);

  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="تكريم المطورين السوريين المساهمين في المصادر المفتوحة"
      title="أفضل المساهمين في GitHub"
    >
      <Pressable
        accessibilityLabel={showEagle ? 'عرض علم سوريا' : 'عرض النسر السوري'}
        accessibilityRole="button"
        onPress={() => setShowEagle((current) => !current)}
        style={({ pressed }) => [styles.heroImageButton, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Image
          accessibilityLabel={showEagle ? 'النسر السوري' : 'علم سوريا'}
          cachePolicy="memory-disk"
          contentFit="contain"
          source={{
            uri: `${apiOrigin}/${showEagle ? 'eagle-logo.svg' : 'syria-flag.svg'}`,
          }}
          style={styles.heroImage}
        />
      </Pressable>
      <AppText style={styles.centerText} variant="heading">
        الجمهورية العربية السورية
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL('https://github.com/z44d')}
        style={styles.credit}
      >
        <Code2 color={theme.palette.foreground} size={17} />
        <AppText color="muted" variant="caption">
          صنع بـ ❤️ بواسطة @z44d
        </AppText>
      </Pressable>

      <View style={styles.periods}>
        {CONTRIBUTION_PERIODS.map((item) => {
          const Icon = periodIcons[item.metric];
          return (
            <AppButton
              key={item.metric}
              icon={
                <Icon
                  color={
                    metric === item.metric
                      ? theme.palette.primaryForeground
                      : theme.palette.foreground
                  }
                  size={17}
                />
              }
              onPress={() => setMetric(item.metric)}
              variant={metric === item.metric ? 'primary' : 'secondary'}
            >
              {item.label}
            </AppButton>
          );
        })}
      </View>

      {query.isPending ? (
        <View accessibilityLabel="جاري تحميل المساهمين" style={styles.loading}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
          <AppText color="muted">جاري تحميل البيانات...</AppText>
        </View>
      ) : null}
      {query.isError && !query.data ? (
        <QueryState
          detail="تعذر تحميل قائمة المساهمين."
          onRetry={() => void query.refetch()}
          type="error"
        />
      ) : null}
      {query.data && ranked.length === 0 ? (
        <QueryState detail="لا توجد بيانات مساهمين حاليًا." type="empty" />
      ) : null}
      {ranked.length > 0 ? (
        <>
          <AppText style={styles.centerText} variant="heading">
            {period?.title}
          </AppText>
          <WinnerCard contributor={ranked[0]!} metric={metric} />
          {ranked.slice(1).map((contributor, index) => (
            <RankedContributor
              contributor={contributor}
              key={contributor.username}
              metric={metric}
              rank={index + 2}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 999,
    borderWidth: 2,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  credit: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
    padding: 8,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  heroImage: {
    height: 120,
    width: 220,
  },
  heroImageButton: {
    alignItems: 'center',
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 220,
  },
  periods: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  rankCard: {
    gap: 12,
  },
  rankHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  score: {
    borderRadius: 14,
    gap: 2,
    padding: 12,
  },
  trophyBadge: {
    backgroundColor: '#facc15',
    borderRadius: 999,
    padding: 7,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  winner: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 460,
    width: '100%',
  },
  winnerAvatar: {
    alignSelf: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/SyrianContributors/Index.tsx (425 lines)
  confidence: high
  todos:      0
  notes:      Native tabs, hourly refresh, ranking cards, image toggle, and GitHub links preserve the source contract.
*/
