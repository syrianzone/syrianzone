"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/sycn/tooltip"
import { Button } from "@/components/sycn/button"

export default function TooltipPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Tooltip" component="tooltip" />
      <InstallCommand command="npx shadcn@latest add tooltip" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">{t("hoverMe")}</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("tooltipText")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ComponentPreview>
    </div>
  )
}
