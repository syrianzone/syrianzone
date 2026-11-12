import type React from 'react';
import { MuslimIcon, QuranIcon, QuranRadioIcon } from '@/Components/Icons/ProjectIcons';

// Single registry for the hub. A tool becomes reachable by adding one entry
// here and a matching route in routes/web.php — the tile grid and the docs read
// this list rather than restating the tools.
//
// Every tool lives at its own real URL under `/muslim/<slug>` (unlike the old
// `?tab=` scheme), so a tool URL is shareable and renders on the server.
export interface ToolEntry {
  /** URL segment under /muslim (also the React key). */
  slug: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TOOLS: ToolEntry[] = [
  {
    slug: 'prayer',
    title: 'مواقيت الصلاة',
    icon: MuslimIcon,
  },
  {
    slug: 'quran',
    title: 'قارئ القرآن',
    icon: QuranIcon,
  },
  {
    slug: 'radio',
    title: 'إذاعة القرآن',
    icon: QuranRadioIcon,
  },
];

export function toolHref(slug: string): string {
  return `/muslim/${slug}`;
}
