import PollLeaderboard, {
  type PollLeaderboardProps,
} from '@/features/Polls/Leaderboard';

import { TimeseriesChart } from './TimeseriesChart';

type TierListLeaderboardProps = Pick<
  PollLeaderboardProps,
  'onBack' | 'onVote'
>;

export default function TierListLeaderboard(props: TierListLeaderboardProps) {
  return (
    <PollLeaderboard
      ChartComponent={TimeseriesChart}
      identifier="best-ministers"
      {...props}
    />
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/TierList/Leaderboard.tsx (348 lines)
  confidence: high
  todos:      0
  notes:      The source duplicate delegates to the shared native leaderboard with the core poll slug.
*/
