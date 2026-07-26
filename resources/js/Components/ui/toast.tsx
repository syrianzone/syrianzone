import * as React from "react"
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant = "default" | "success" | "destructive" | "warning" | "info"

export interface ToastProps {
  id: string | number
  message: string
  title?: string
  variant?: ToastVariant
  onDismiss?: () => void
  duration?: number
}

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-popover text-popover-foreground border-border",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
}

const variantIcons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  destructive: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export function Toast({
  message,
  title,
  variant = "default",
  onDismiss,
}: ToastProps) {
  const Icon = variantIcons[variant]

  return (
    <div
      dir="rtl"
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md transition-all animate-in fade-in-50 slide-in-from-bottom-5 duration-300",
        variantStyles[variant]
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="text-xs font-bold leading-tight">{title}</p>}
        <p className="text-xs font-medium leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
