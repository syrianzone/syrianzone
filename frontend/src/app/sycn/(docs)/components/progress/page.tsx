"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Progress } from "@/components/sycn/progress"
import { useT } from "@/app/sycn/i18n"

export default function ProgressPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Progress" component="progress" />
      <InstallCommand name="progress" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Progress } from "@/components/sycn/progress"\n\n<Progress value={60} />`}>
        <Progress value={60} className="max-w-sm" />
      </ComponentPreview>
    </div>
  )
}
