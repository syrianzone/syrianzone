import React from 'react';
import { Button } from '@/Components/ui/button';

interface ProgressiveListFooterProps {
    hasMore: boolean;
    remaining: number;
    onShowMore: () => void;
    sentinelRef: React.Ref<HTMLDivElement>;
}

export function ProgressiveListFooter({
    hasMore,
    remaining,
    onShowMore,
    sentinelRef,
}: ProgressiveListFooterProps) {
    if (!hasMore) return null;

    return (
        <div ref={sentinelRef} className="flex justify-center pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onShowMore}>
                عرض المزيد (تبقّى {remaining})
            </Button>
        </div>
    );
}
