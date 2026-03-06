"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Toggle } from "@/components/sycn/toggle"
import { useT } from "@/app/sycn/i18n"

export default function TogglePage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Toggle" component="toggle" />
      <InstallCommand name="toggle" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Toggle } from "@/components/sycn/toggle"\n\n<Toggle>Bold</Toggle>`}>
        <Toggle>{t("bold")}</Toggle>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("variants")}</h2>
      <ComponentPreview code={`<Toggle variant="default">Default</Toggle>\n<Toggle variant="outline">Outline</Toggle>`}>
        <div className="flex gap-2">
          <Toggle variant="default">{t("default")}</Toggle>
          <Toggle variant="outline">{t("outline")}</Toggle>
        </div>
      </ComponentPreview>
    </div>
  )
}
