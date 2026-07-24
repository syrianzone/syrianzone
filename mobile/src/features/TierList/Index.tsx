import { useState } from 'react';

import PollShow from '@/features/Polls/Show';

import TierListLeaderboard from './Leaderboard';

const governmentPoll = 'best-ministers';

export default function TierListIndex() {
  const [results, setResults] = useState(false);
  return results
    ? <TierListLeaderboard onVote={() => setResults(false)} />
    : <PollShow identifier={governmentPoll} onLeaderboard={() => setResults(true)} />;
}

/*
PORT STATUS
  source:     resources/js/Pages/TierList/Index.tsx (103 lines)
  confidence: high
  todos:      0
  notes:      The government tier list reuses the complete native poll board and results contracts.
*/
