"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Slider } from "@/components/sycn/slider"
import { useT } from "@/app/sycn/i18n"

export default function SliderPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Slider" component="slider" />
      <InstallCommand name="slider" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Slider } from "@/components/sycn/slider"\n\n<Slider defaultValue={[50]} max={100} step={1} />`}>
        <Slider defaultValue={[50]} max={100} step={1} className="max-w-sm" />
      </ComponentPreview>
    </div>
  )
}
