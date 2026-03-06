"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { AspectRatio } from "@/components/sycn/aspect-ratio"

export default function AspectRatioPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Aspect Ratio" component="aspect-ratio" />
      <InstallCommand command="npx shadcn@latest add aspect-ratio" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <div className="w-[450px]">
          <AspectRatio ratio={16 / 9}>
            <div className="flex h-full w-full items-center justify-center rounded-md bg-muted">
              <span className="text-sm text-muted-foreground">{t("aspectRatio")}</span>
            </div>
          </AspectRatio>
        </div>
      </ComponentPreview>
    </div>
  )
}
