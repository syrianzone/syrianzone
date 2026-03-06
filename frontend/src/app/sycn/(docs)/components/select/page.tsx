"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/sycn/select"
import { useT } from "@/app/sycn/i18n"

export default function SelectPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Select" component="select" />
      <InstallCommand name="select" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("search")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option-1">{t("option1")}</SelectItem>
            <SelectItem value="option-2">{t("option2")}</SelectItem>
            <SelectItem value="option-3">{t("option3")}</SelectItem>
          </SelectContent>
        </Select>
      </ComponentPreview>
    </div>
  )
}
