"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Button } from "@/components/sycn/button"
import { useT } from "@/app/sycn/i18n"

export default function ButtonPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Button" component="button" />
      <InstallCommand name="button" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Button } from "@/components/sycn/button"\n\n<Button>Click me</Button>`}>
        <Button>{t("clickMe")}</Button>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("variants")}</h2>
      <ComponentPreview code={`<Button variant="default">Default</Button>\n<Button variant="destructive">Destructive</Button>\n<Button variant="outline">Outline</Button>\n<Button variant="secondary">Secondary</Button>\n<Button variant="ghost">Ghost</Button>\n<Button variant="link">Link</Button>`}>
        <div className="flex gap-2 flex-wrap">
          <Button variant="default">{t("default")}</Button>
          <Button variant="destructive">{t("destructive")}</Button>
          <Button variant="outline">{t("outline")}</Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="ghost">{t("ghost")}</Button>
          <Button variant="link">{t("link")}</Button>
        </div>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("sizes")}</h2>
      <ComponentPreview code={`<Button size="default">Default</Button>\n<Button size="sm">Small</Button>\n<Button size="lg">Large</Button>\n<Button size="icon">I</Button>`}>
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="default">{t("default")}</Button>
          <Button size="sm">{t("small")}</Button>
          <Button size="lg">{t("large")}</Button>
          <Button size="icon">I</Button>
        </div>
      </ComponentPreview>
    </div>
  )
}
