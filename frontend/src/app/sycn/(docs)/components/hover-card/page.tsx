"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/sycn/hover-card"
import { Button } from "@/components/sycn/button"

export default function HoverCardPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Hover Card" component="hover-card" />
      <InstallCommand command="npx shadcn@latest add hover-card" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link">{t("hoverMe")}</Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">{t("hoverCardTitle")}</h4>
              <p className="text-sm text-muted-foreground">{t("hoverCardDesc")}</p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </ComponentPreview>
    </div>
  )
}
