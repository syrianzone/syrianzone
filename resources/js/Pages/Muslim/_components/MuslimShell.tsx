import React from 'react';
import { PageBody, PageHeader, type ShellWidth } from '@/Components/layout';

interface Props {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Canonical page column width: narrow (48rem) or default (76rem). */
  width?: Extract<ShellWidth, 'narrow' | 'default'>;
  children: React.ReactNode;
}

// Chrome shared by the /muslim/<tool> pages: breadcrumb back to the hub,
// direct Beiruti <h1> via PageHeader, then the tool itself.
export default function MuslimShell({ title, width = 'narrow', children }: Props) {
  return (
    <div className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground" dir="rtl">
      <PageHeader
        title={title}
        width={width}
        breadcrumbs={[
          { label: 'الركن الإسلامي', href: '/muslim' },
          { label: title },
        ]}
        divider
      />
      <PageBody width={width} className="pt-4">
        {children}
      </PageBody>
    </div>
  );
}
