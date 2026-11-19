import { Avatar, AvatarFallback, AvatarImage } from '@/Components/ui/avatar';
import { cn } from '@/Lib/utils';
import { officialInitials, resolveOfficialPortrait } from './constants';

interface Props {
    name: string | null | undefined;
    portraitUrl?: string | null;
    resolvedPortraitUrl?: string | null;
    size?: number;
    className?: string;
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
}: Props) {
    const src = resolveOfficialPortrait(resolvedPortraitUrl, portraitUrl);
    const initials = officialInitials(name);

    return (
        <Avatar
            className={cn(
                'shrink-0 border border-border bg-muted font-bold text-muted-foreground',
                className,
            )}
            style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.36)) }}
            aria-hidden="true"
        >
            {src && (
                <AvatarImage
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                />
            )}
            <AvatarFallback className="bg-muted font-bold text-muted-foreground">
                {initials}
            </AvatarFallback>
        </Avatar>
    );
}
