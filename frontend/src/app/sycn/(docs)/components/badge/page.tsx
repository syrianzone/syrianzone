"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Badge } from "@/components/sycn/badge"
import { useT } from "@/app/sycn/i18n"

export default function BadgePage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Badge" component="badge" />
      <InstallCommand name="badge" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Badge } from "@/components/sycn/badge"\n\n<Badge>Badge</Badge>`}>
        <Badge>Badge</Badge>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("variants")}</h2>
      <ComponentPreview code={`<Badge variant="default">Default</Badge>\n<Badge variant="secondary">Secondary</Badge>\n<Badge variant="outline">Outline</Badge>\n<Badge variant="destructive">Destructive</Badge>`}>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="default">{t("default")}</Badge>
          <Badge variant="secondary">{t("secondary")}</Badge>
          <Badge variant="outline">{t("outline")}</Badge>
          <Badge variant="destructive">{t("destructive")}</Badge>
        </div>
      </ComponentPreview>
    </div>
  )
}
