"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Alert, AlertTitle, AlertDescription } from "@/components/sycn/alert"
import { useT } from "@/app/sycn/i18n"

export default function AlertPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Alert" component="alert" />
      <InstallCommand name="alert" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Alert>
          <AlertTitle>{t("headsUp")}</AlertTitle>
          <AlertDescription>{t("alertDesc")}</AlertDescription>
        </Alert>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("destructive")}</h2>
      <ComponentPreview>
        <Alert variant="destructive">
          <AlertTitle>{t("error")}</AlertTitle>
          <AlertDescription>{t("somethingWrong")}</AlertDescription>
        </Alert>
      </ComponentPreview>
    </div>
  )
}
