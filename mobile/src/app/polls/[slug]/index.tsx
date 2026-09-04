import { useLocalSearchParams } from 'expo-router';

import { backToPolls, openPollLeaderboard } from '@/features/Polls/navigation';
import PollShow from '@/features/Polls/Show';

export default function PollRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <PollShow
      identifier={slug}
      onBack={backToPolls}
      onLeaderboard={() => openPollLeaderboard(slug)}
    />
  );
}
