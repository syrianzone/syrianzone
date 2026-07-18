import type { PropsWithChildren } from 'react';

export const contributorScreenOptions = {
  description:
    'تكريم المطورين السوريين المساهمين في المصادر المفتوحة والبرمجيات الحرة.',
  title: 'أفضل المساهمين السوريين في GitHub',
} as const;

export default function ContributorsLayout({
  children,
}: PropsWithChildren) {
  return children;
}

/*
PORT STATUS
  source:     resources/js/Pages/SyrianContributors/layout.tsx (19 lines)
  confidence: high
  todos:      0
  notes:      Expo screen options preserve the source title and description without browser metadata.
*/
