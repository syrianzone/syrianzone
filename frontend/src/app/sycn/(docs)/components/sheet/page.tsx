"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/sycn/sheet"
import { Button } from "@/components/sycn/button"

export default function SheetPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Sheet" component="sheet" />
      <InstallCommand command="npx shadcn@latest add sheet" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <div className="flex gap-2">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild>
                <Button variant="outline">{side}</Button>
              </SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>{side}</SheetTitle>
                  <SheetDescription>{t("makeChanges")}</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      </ComponentPreview>
    </div>
  )
}
