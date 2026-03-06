import { DocHeader } from "@/components/sycn/docs/doc-header"

const weights = [
  { name: "Light", weight: 300, arabic: "خفيف" },
  { name: "Regular", weight: 400, arabic: "عادي" },
  { name: "Medium", weight: 500, arabic: "متوسط" },
  { name: "Bold", weight: 700, arabic: "غامق" },
  { name: "Black", weight: 900, arabic: "أسود" },
]

const sizes = [48, 36, 30, 24, 20, 18, 16, 14, 12]

export default function TypographyPage() {
  return (
    <div className="space-y-8">
      <DocHeader
        title="الخطوط"
        description="خط قمرة — الخط الرئيسي للهوية البصرية السورية"
      />
      <p className="text-sm text-muted-foreground">
        Qomra by iWanType —{" "}
        <a href="https://iwantype.com" target="_blank" rel="noreferrer" className="underline">
          iwantype.com
        </a>
      </p>

      <div className="space-y-6">
        {weights.map((w) => (
          <div key={w.weight} className="border-b pb-6">
            <div className="text-[13px] text-muted-foreground mb-1">
              {w.name} ({w.weight}) — {w.arabic}
            </div>
            <div style={{ fontWeight: w.weight }} className="text-[2rem] leading-relaxed" dir="rtl">
              الجمهورية العربية السورية
            </div>
            <div style={{ fontWeight: w.weight }} className="text-[2rem] leading-relaxed">
              Syrian Arab Republic
            </div>
            <div style={{ fontWeight: w.weight }} className="text-base leading-relaxed mt-2" dir="rtl">
              سوريا بلد الحضارات والتاريخ العريق، من دمشق أقدم عاصمة مأهولة في العالم إلى تدمر وأوغاريت.
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">مقياس الخطوط — Type Scale</h2>
        <div className="space-y-2">
          {sizes.map((size) => (
            <div key={size} className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-10 font-mono">{size}px</span>
              <span style={{ fontSize: size }} dir="rtl">سوريا</span>
              <span style={{ fontSize: size }}>Syria</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
