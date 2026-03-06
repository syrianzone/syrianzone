"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/sycn/card"
import { Button } from "@/components/sycn/button"
import { useT } from "@/app/sycn/i18n"

export default function CardPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Card" component="card" />
      <InstallCommand name="card" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>{t("cardTitle")}</CardTitle>
            <CardDescription>{t("cardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>{t("cardContent")}</p>
          </CardContent>
          <CardFooter>
            <Button>{t("action")}</Button>
          </CardFooter>
        </Card>
      </ComponentPreview>
    </div>
  )
}
