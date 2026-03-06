"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { useDir } from "../dir-context"

const i18n = {
  rtl: {
    identity: "الهوية البصرية",
    components: "العناصر",
    palette: "لوحة الألوان",
    typography: "الخطوط",
    flag: "العلم",
    map: "الخريطة",
    resources: "الموارد",
  },
  ltr: {
    identity: "Visual Identity",
    components: "Components",
    palette: "Color Palette",
    typography: "Typography",
    flag: "Flag",
    map: "Map",
    resources: "Resources",
  },
}

type Dir = "rtl" | "ltr"

const identityItems = [
  { en: "palette", ar: "palette" },
  { en: "typography", ar: "typography" },
  { en: "flag", ar: "flag" },
  { en: "map", ar: "map" },
  { en: "resources", ar: "resources" },
]

const components: { en: string; ar: string }[] = [
  { en: "Accordion", ar: "أكورديون" },
  { en: "Alert", ar: "تنبيه" },
  { en: "Alert Dialog", ar: "نافذة تنبيه" },
  { en: "Aspect Ratio", ar: "نسبة العرض" },
  { en: "Avatar", ar: "صورة رمزية" },
  { en: "Badge", ar: "شارة" },
  { en: "Breadcrumb", ar: "مسار التنقل" },
  { en: "Button", ar: "زر" },
  { en: "Calendar", ar: "تقويم" },
  { en: "Card", ar: "بطاقة" },
  { en: "Checkbox", ar: "مربع اختيار" },
  { en: "Collapsible", ar: "قابل للطي" },
  { en: "Command", ar: "لوحة أوامر" },
  { en: "Context Menu", ar: "قائمة سياقية" },
  { en: "Dialog", ar: "نافذة حوار" },
  { en: "Dropdown Menu", ar: "قائمة منسدلة" },
  { en: "Hover Card", ar: "بطاقة تمرير" },
  { en: "Input", ar: "حقل إدخال" },
  { en: "Label", ar: "تسمية" },
  { en: "Menubar", ar: "شريط قوائم" },
  { en: "Navigation Menu", ar: "قائمة تنقل" },
  { en: "Pagination", ar: "ترقيم صفحات" },
  { en: "Popover", ar: "نافذة منبثقة" },
  { en: "Progress", ar: "شريط تقدم" },
  { en: "Radio Group", ar: "مجموعة اختيار" },
  { en: "Scroll Area", ar: "منطقة تمرير" },
  { en: "Select", ar: "قائمة اختيار" },
  { en: "Separator", ar: "فاصل" },
  { en: "Sheet", ar: "لوحة جانبية" },
  { en: "Sidebar", ar: "شريط جانبي" },
  { en: "Skeleton", ar: "هيكل تحميل" },
  { en: "Slider", ar: "شريط تمرير" },
  { en: "Switch", ar: "مفتاح تبديل" },
  { en: "Table", ar: "جدول" },
  { en: "Tabs", ar: "تبويبات" },
  { en: "Textarea", ar: "حقل نصي" },
  { en: "Toast", ar: "إشعار" },
  { en: "Toggle", ar: "زر تبديل" },
  { en: "Toggle Group", ar: "مجموعة تبديل" },
  { en: "Tooltip", ar: "تلميح" },
]

function DirToggle({ dir, setDir }: { dir: Dir; setDir: (d: Dir) => void }) {
  return (
    <button
      onClick={() => setDir(dir === "rtl" ? "ltr" : "rtl")}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      {dir === "rtl" ? "EN" : "عربي"}
    </button>
  )
}

export default function SycnDocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { dir, setDir } = useDir()
  const t = i18n[dir]

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-inline-start-0 top-0 h-screen w-[250px] overflow-y-auto scrollbar-none border-fade-e" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div className="p-4">
          <Link href="/sycn" className="flex items-center gap-2.5 mb-4">
            <Image src="/sycn/emblem.svg" alt="sycn" width={40} height={40} />
            <span className="text-xl font-bold">sycn</span>
          </Link>

          <div className="flex gap-2 mb-6">
            <DirToggle dir={dir} setDir={setDir} />
          </div>

          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t.identity}
            </h2>
            <ul className="space-y-0.5">
              {identityItems.map((item) => {
                const href = `/sycn/identity/${item.en}`
                const active = pathname === href
                return (
                  <li key={item.en}>
                    <Link
                      href={href}
                      className="block rounded-md px-2 py-1.5 text-sm transition-colors"
                      style={{
                        backgroundColor: active ? "hsl(var(--accent))" : undefined,
                        color: active ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))",
                        fontWeight: active ? 500 : undefined,
                      }}
                    >
                      {t[item.en as keyof typeof t]}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t.components}
            </h2>
            <ul className="space-y-0.5">
              {components.map((item) => {
                const slug = item.en.toLowerCase().replace(/ /g, "-")
                const href = `/sycn/components/${slug}`
                const active = pathname === href
                return (
                  <li key={slug}>
                    <Link
                      href={href}
                      className="block rounded-md px-2 py-1.5 text-sm transition-colors"
                      style={{
                        backgroundColor: active ? "hsl(var(--accent))" : undefined,
                        color: active ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))",
                        fontWeight: active ? 500 : undefined,
                      }}
                    >
                      {dir === "rtl" ? item.ar : item.en}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex-1 ms-[250px] flex flex-col min-h-screen">
        <div className="max-w-3xl mx-auto px-8 py-12 flex-1">{children}</div>
        <footer className="py-6 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))", backgroundImage: "linear-gradient(to right, transparent, hsl(var(--border)) 15%, hsl(var(--border)) 85%, transparent)", backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "top" }}>
          {dir === "rtl" ? (
            <>
              © {new Date().getFullYear()} نظام تصميم الهوية البصرية السورية - تم تطويرها بواسطة{" "}
              <a href="https://x.com/macdoos" target="_blank" rel="noopener noreferrer" className="underline transition-colors">
                مكدوس
              </a>
            </>
          ) : (
            <>
              © {new Date().getFullYear()} sycn. Developed by{" "}
              <a href="https://x.com/macdoos" target="_blank" rel="noopener noreferrer" className="underline transition-colors">
                @macdoos
              </a>
            </>
          )}
        </footer>
      </main>
    </div>
  )
}
