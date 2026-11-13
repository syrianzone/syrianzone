import { cn } from '@/Lib/utils';
import { nameInitial, speakerImage } from './format';

/**
 * A speaker's portrait, or the first letter of their name on a muted disc.
 * Decorative: the name is always printed next to it.
 */
export default function SpeakerAvatar({ name, image, size = 40, className }: {
    name: string | null;
    image: string | null;
    size?: number;
    className?: string;
}) {
    const src = speakerImage(image);

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted font-bold text-muted-foreground',
                className,
            )}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
            aria-hidden="true"
        >
            {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
                nameInitial(name)
            )}
        </span>
    );
}
