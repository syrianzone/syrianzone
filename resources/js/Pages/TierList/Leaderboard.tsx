// `/tierlist/leaderboard` and `/polls/{slug}/leaderboard` are the same page over
// the same `PollController::leaderboardPayload()`. The poll leaderboard owns the
// implementation; this file stays because the page name is a server contract
// (`Inertia::render('TierList/Leaderboard')`).
export { default } from '@/Pages/Polls/Leaderboard';
