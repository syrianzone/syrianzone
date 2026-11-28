import React from 'react';
import { PageHeader } from '@/Components/layout';

interface Props {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Tailwind max-width for the page column. */
  width?: string;
  children: React.ReactNode;
}

// Chrome shared by the /muslim/<tool> pages: breadcrumb back to the hub,
// direct Beiruti <h1> via PageHeader, then the tool itself.
export default function MuslimShell({ title, width = 'max-w-2xl', children }: Props) {
  return (
    <div className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground" dir="rtl">
      <div className={`container mx-auto ${width} px-4 py-6 sm:py-8 space-y-6`}>
        <PageHeader
          title={title}
          breadcrumbs={[
            { label: 'الركن الإسلامي', href: '/muslim' },
            { label: title },
          ]}
          divider
        />

        {children}
      </div>
    </div>
  );
}
