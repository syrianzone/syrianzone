import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/Components/ui/avatar';
import { cn } from '@/Lib/utils';
import { officialInitials, resolveOfficialPortrait } from './constants';

interface Props {
    name: string | null | undefined;
    portraitUrl?: string | null;
    resolvedPortraitUrl?: string | null;
    size?: number;
    className?: string;
    /**
     * Above-the-fold hero portrait: render a plain eager <img> that is in the
     * server HTML (Radix AvatarImage only mounts after it loads on the client),
     * with the initials underneath in case it fails.
     */
    priority?: boolean;
}

/**
 * Circular portrait with Arabic initials fallback.
 * Decorative (`aria-hidden="true"`): the official's name is always rendered beside it.
 */
export default function OfficialAvatar({
    name,
    portraitUrl,
    resolvedPortraitUrl,
    size = 48,
    className,
    priority = false,
}: Props) {
    const src = resolveOfficialPortrait(resolvedPortraitUrl, portraitUrl);
    const initials = officialInitials(name);
    const [failed, setFailed] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // A server-rendered image can fail before hydration attaches onError.
    useEffect(() => {
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth === 0) setFailed(true);
    }, [src]);

    return (
        <Avatar
            className={cn(
                'shrink-0 border border-border bg-muted font-bold text-muted-foreground',
                className,
            )}
            style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.36)) }}
            aria-hidden="true"
        >
            {priority ? (
                <>
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">
                        {initials}
                    </span>
                    {src && !failed && (
                        <img
                            ref={imgRef}
                            src={src}
                            alt=""
                            width={size}
                            height={size}
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            onError={() => setFailed(true)}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}
                </>
            ) : src && (
                <AvatarImage
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                />
            )}
            {!priority && (
                <AvatarFallback className="bg-muted font-bold text-muted-foreground">
                    {initials}
                </AvatarFallback>
            )}
        </Avatar>
    );
}
