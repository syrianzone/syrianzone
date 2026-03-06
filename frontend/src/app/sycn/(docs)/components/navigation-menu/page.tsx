"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/sycn/navigation-menu"

export default function NavigationMenuPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Navigation Menu" component="navigation-menu" />
      <InstallCommand command="npx shadcn@latest add navigation-menu" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>{t("gettingStarted")}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid gap-3 p-4 w-[400px]">
                  <NavigationMenuLink href="/docs">{t("introduction")}</NavigationMenuLink>
                  <NavigationMenuLink href="/docs/installation">{t("installation")}</NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>{t("components")}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid gap-3 p-4 w-[400px]">
                  <NavigationMenuLink href="/docs/components">{t("overview")}</NavigationMenuLink>
                  <NavigationMenuLink href="/sycn/components/button">Button</NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </ComponentPreview>
    </div>
  )
}
