import * as React from "react";
import { cn } from "@/lib/utils";

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "destructive";
};

const variantClasses: Record<NonNullable<AlertProps["variant"]>, string> = {
    default:
        "bg-white text-neutral-900 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800",
    destructive:
        "bg-red-50 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800",
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
