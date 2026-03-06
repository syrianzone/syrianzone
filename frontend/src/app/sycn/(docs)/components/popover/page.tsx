"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/sycn/popover"
import { Button } from "@/components/sycn/button"

export default function PopoverPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Popover" component="popover" />
      <InstallCommand command="npx shadcn@latest add popover" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t("open")}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">{t("popoverTitle")}</h4>
              <p className="text-sm text-muted-foreground">{t("popoverDesc")}</p>
            </div>
          </PopoverContent>
        </Popover>
      </ComponentPreview>
    </div>
  )
}
