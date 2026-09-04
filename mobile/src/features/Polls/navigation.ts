import { router } from 'expo-router';

// Poll routes are deep-linkable, so a back action cannot assume there is a stack to pop.
function backOrReplace(fallback: () => void): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  fallback();
}

export function openPoll(slug: string): void {
  router.push({ params: { slug }, pathname: '/polls/[slug]' });
}

export function openPollLeaderboard(slug: string): void {
  router.push({ params: { slug }, pathname: '/polls/[slug]/leaderboard' });
}

export function backToPolls(): void {
  backOrReplace(() =>
    router.replace({ params: { slug: 'polls' }, pathname: '/feature/[slug]' }),
  );
}

export function backToPoll(slug: string): void {
  backOrReplace(() =>
    router.replace({ params: { slug }, pathname: '/polls/[slug]' }),
  );
}
