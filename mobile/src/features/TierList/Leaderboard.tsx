import PollLeaderboard from '@/features/Polls/Leaderboard';

interface TierListLeaderboardProps {
  onBack?: () => void;
  onVote?: () => void;
}

export default function TierListLeaderboard(props: TierListLeaderboardProps) {
  return <PollLeaderboard identifier="best-ministers" {...props} />;
}

/*
PORT STATUS
  source:     resources/js/Pages/TierList/Leaderboard.tsx (348 lines)
  confidence: high
  todos:      0
  notes:      The source duplicate delegates to the shared native leaderboard with the core poll slug.
*/
