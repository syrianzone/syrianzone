import { ImgHTMLAttributes } from "react";
import { cn } from "@/Lib/utils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & { src?: string; size?: number };

export function TierAvatar({ className, size = 36, alt = "", src, ...rest }: Props) {
    return (
        <img
            className={cn("rounded-full object-cover", className)}
            style={{ width: size, height: size, userSelect: "none" as const, pointerEvents: "none" as const }}
            width={size}
            height={size}
            src={src ?? ""}
            alt={alt}
            // The board holds dozens of candidates; the exporter loads its own
            // copies, so these can wait for the viewport and decode off-thread.
            loading="lazy"
            decoding="async"
            draggable={false}
            {...rest}
        />
    );
}
