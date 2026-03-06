"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/sycn/collapsible"
import { Button } from "@/components/sycn/button"

export default function CollapsiblePage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Collapsible" component="collapsible" />
      <InstallCommand command="npx shadcn@latest add collapsible" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Collapsible className="w-[350px] space-y-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {t("toggleContent")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <div className="rounded-md border px-4 py-3 text-sm">{t("item1")}</div>
            <div className="rounded-md border px-4 py-3 text-sm">{t("item2")}</div>
            <div className="rounded-md border px-4 py-3 text-sm">{t("item3")}</div>
          </CollapsibleContent>
        </Collapsible>
      </ComponentPreview>
    </div>
  )
}
