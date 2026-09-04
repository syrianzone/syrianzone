import { resolveWebsiteDeepLink } from '@/lib/linking';

// expo-router hands every incoming deep link here before it resolves a route.
// Android app links arrive as website URLs (https://syrian.zone/tierlist) whose
// paths have no route file, so they are rewritten to the native route that
// renders the same page. Throwing here crashes the app, hence the catch.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return resolveWebsiteDeepLink(path) ?? path;
  } catch {
    return path;
  }
}
