import * as React from "react"
import { Toaster as Sonner, toast } from "sonner"
import { useColorScheme } from "@/lib/theme"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = (props: ToasterProps) => {
  const theme = useColorScheme()

  return (
    <Sonner
      dir="rtl"
      position="bottom-left"
      theme={theme}
      richColors
      closeButton
      className="toaster group font-sans"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl p-3.5 text-xs font-semibold",
          description: "group-[.toast]:text-muted-foreground text-[11px]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
