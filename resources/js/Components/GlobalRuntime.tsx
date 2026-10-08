import { useUsageTracker } from '@/Lib/usageStore';

/** Mounted once per layout: starts the global listening-usage tracker. */
export default function GlobalRuntime() {
  useUsageTracker();
  return null;
}
