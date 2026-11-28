import * as React from "react";
import { cn } from "@/Lib/utils";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "destructive" | "success" | "warning" | "info";
};

const variantClasses: Record<NonNullable<AlertProps["variant"]>, string> = {
    default: "bg-card text-card-foreground border-border",
    destructive:
        "bg-[color-mix(in_oklab,hsl(var(--destructive))_10%,hsl(var(--card)))] text-destructive border-[color-mix(in_oklab,hsl(var(--destructive))_35%,hsl(var(--border)))] [&>svg]:text-destructive",
    success:
        "bg-[color-mix(in_oklab,hsl(var(--success))_10%,hsl(var(--card)))] text-foreground border-[color-mix(in_oklab,hsl(var(--success))_35%,hsl(var(--border)))] [&>svg]:text-success",
    warning:
        "bg-[color-mix(in_oklab,hsl(var(--warning))_10%,hsl(var(--card)))] text-foreground border-[color-mix(in_oklab,hsl(var(--warning))_35%,hsl(var(--border)))] [&>svg]:text-warning",
    info:
        "bg-[color-mix(in_oklab,hsl(var(--info))_10%,hsl(var(--card)))] text-foreground border-[color-mix(in_oklab,hsl(var(--info))_35%,hsl(var(--border)))] [&>svg]:text-info",
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    { className, children, variant = "default", role = "alert", ...props },
    ref
) {
    return (
        <div
            ref={ref}
            role={role}
            className={cn(
                "relative w-full rounded-md border p-4 text-sm flex items-start gap-3",
                variantClasses[variant],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(function AlertTitle(
    { className, ...props },
    ref
) {
    return (
        <h5
            ref={ref}
            className={cn("font-semibold leading-none tracking-tight", className)}
            {...props}
        />
    );
});

export const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function AlertDescription(
    { className, ...props },
    ref
) {
    return (
        <div
            ref={ref}
            className={cn("text-sm text-current/90 [&_p]:leading-relaxed", className)}
            {...props}
        />
    );
});
