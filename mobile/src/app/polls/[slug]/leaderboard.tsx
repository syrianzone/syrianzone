import { useLocalSearchParams } from 'expo-router';

import PollLeaderboard from '@/features/Polls/Leaderboard';
import { backToPoll } from '@/features/Polls/navigation';

export default function PollLeaderboardRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <PollLeaderboard
      identifier={slug}
      onBack={() => backToPoll(slug)}
      onVote={() => backToPoll(slug)}
    />
  );
}
