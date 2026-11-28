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
  const headerWidth = width === 'max-w-2xl' || width === 'max-w-3xl' ? 'narrow' : 'default';
  return (
    <div className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground" dir="rtl">
      <PageHeader
        title={title}
        width={headerWidth}
        breadcrumbs={[
          { label: 'الركن الإسلامي', href: '/muslim' },
          { label: title },
        ]}
        divider
      />
      <div className={`mx-auto w-full ${width} px-4 pb-12 pt-4 md:px-8`}>
        {children}
      </div>
    </div>
  );
}
