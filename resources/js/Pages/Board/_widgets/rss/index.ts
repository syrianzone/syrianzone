import { Rss } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export interface RssConfig {
  source: string;
}

// The source list is a curated allowlist, mirrored from FeedController::SOURCES.
// Arbitrary urls are deliberately not offered: that would mean ssrf hardening,
// redirect handling, and an unbounded cache keyspace on the server.
export const RSS_SOURCES = [
  { value: 'jard', label: 'موجز أخبار سوريا' },
  { value: 'sana', label: 'سانا' },
  { value: 'halab-today', label: 'حلب اليوم' },
  { value: 'syrian-observer', label: 'ذا سيريان أوبزرفر' },
];

export const rssWidget: WidgetDeclaration = {
  id: 'rss',
  name: 'الأخبار',
  description: 'آخر العناوين من مصدر إخباري سوري',
  icon: Rss,
  category: 'community',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  fields: [
    {
      key: 'source',
      type: 'select',
      label: 'المصدر',
      default: 'jard',
      options: RSS_SOURCES,
    },
  ],
  requires: [],
  // the endpoint caches for 10 minutes server-side
  refresh: { staleMs: 10 * 60_000, intervalMs: 15 * 60_000 },
  multiple: true,
  seed: { order: 7, w: 6, h: 3 },
  source: sources.feed,
};

export default rssWidget;
