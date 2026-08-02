import { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { getDisplayImageUrl } from "@/Lib/imageUtils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & { src?: string; size?: number };

export function TierAvatar({ className, size = 36, alt = "", src, ...rest }: Props) {
    const displaySrc = getDisplayImageUrl(src, Math.max(size * 2, 200));
    return (
        <img
            className={cn("rounded-full object-cover", className)}
            style={{ width: size, height: size, userSelect: "none" as const, pointerEvents: "none" as const }}
            width={size}
            height={size}
            src={displaySrc}
            alt={alt}
            loading="eager"
            decoding="sync"
            draggable={false}
            {...rest}
        />
    );
}
