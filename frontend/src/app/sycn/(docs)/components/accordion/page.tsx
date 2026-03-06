"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/sycn/accordion"

export default function AccordionPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Accordion" component="accordion" />
      <InstallCommand command="npx shadcn@latest add accordion" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Accordion type="single" collapsible className="w-full max-w-md">
          <AccordionItem value="item-1">
            <AccordionTrigger>{t("item1")}</AccordionTrigger>
            <AccordionContent>{t("content1")}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>{t("item2")}</AccordionTrigger>
            <AccordionContent>{t("content2")}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>{t("item3")}</AccordionTrigger>
            <AccordionContent>{t("content3")}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </ComponentPreview>
    </div>
  )
}
