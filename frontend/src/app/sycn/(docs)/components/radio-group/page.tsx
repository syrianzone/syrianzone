"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { RadioGroup, RadioGroupItem } from "@/components/sycn/radio-group"
import { Label } from "@/components/sycn/label"
import { useT } from "@/app/sycn/i18n"

export default function RadioGroupPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Radio Group" component="radio-group" />
      <InstallCommand name="radio-group" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { RadioGroup, RadioGroupItem } from "@/components/sycn/radio-group"\nimport { Label } from "@/components/sycn/label"\n\n<RadioGroup defaultValue="option-one">\n  <div className="flex items-center space-x-2">\n    <RadioGroupItem value="option-one" id="option-one" />\n    <Label htmlFor="option-one">Option One</Label>\n  </div>\n  <div className="flex items-center space-x-2">\n    <RadioGroupItem value="option-two" id="option-two" />\n    <Label htmlFor="option-two">Option Two</Label>\n  </div>\n  <div className="flex items-center space-x-2">\n    <RadioGroupItem value="option-three" id="option-three" />\n    <Label htmlFor="option-three">Option Three</Label>\n  </div>\n</RadioGroup>`}>
        <RadioGroup defaultValue="option-one">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option-one" id="option-one" />
            <Label htmlFor="option-one">{t("option1")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option-two" id="option-two" />
            <Label htmlFor="option-two">{t("option2")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option-three" id="option-three" />
            <Label htmlFor="option-three">{t("option3")}</Label>
          </div>
        </RadioGroup>
      </ComponentPreview>
    </div>
  )
}
