import * as React from "react"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ theme: themeProp, ...props }: ToasterProps) => {
  const [theme, setTheme] = React.useState<"light" | "dark" | "system">("system")

  React.useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.getAttribute("data-transit-theme") === "damascus-rose"
      setTheme(isDark ? "dark" : "light")
    }
    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-transit-theme"],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      dir="rtl"
      position="bottom-left"
      theme={themeProp || theme}
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
