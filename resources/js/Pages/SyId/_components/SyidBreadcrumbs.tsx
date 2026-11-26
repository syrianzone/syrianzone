import React from 'react';
import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';

interface SyidBreadcrumbsProps {
    currentLabel: string;
}

export function SyidBreadcrumbs({ currentLabel }: SyidBreadcrumbsProps) {
    return (
        <nav aria-label="مسار التنقل" className="text-xs sm:text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                    <Link href="/" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
                        الرئيسية
                    </Link>
                </li>
                <li aria-hidden="true">
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/70" />
                </li>
                <li>
                    <Link href="/syid" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
                        الهوية البصرية السورية
                    </Link>
                </li>
                <li aria-hidden="true">
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/70" />
                </li>
                <li aria-current="page" className="font-medium text-foreground">
                    {currentLabel}
                </li>
            </ol>
        </nav>
    );
}
