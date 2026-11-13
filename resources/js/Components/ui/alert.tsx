import * as React from "react";
import { cn } from "@/Lib/utils";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "destructive" | "success" | "warning";
};

const variantClasses: Record<NonNullable<AlertProps["variant"]>, string> = {
    default: "bg-card text-card-foreground border-border",
    destructive:
        "bg-destructive/10 text-destructive border-destructive/30",
    success:
        "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    warning:
        "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
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
