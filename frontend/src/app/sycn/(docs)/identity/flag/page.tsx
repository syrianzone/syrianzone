import { DocHeader } from "@/components/sycn/docs/doc-header"

const flagColors = [
  { name: "أخضر — Green", hex: "#007a3d" },
  { name: "أبيض — White", hex: "#ffffff" },
  { name: "أسود — Black", hex: "#000000" },
  { name: "أحمر — Red (Stars)", hex: "#ce1126" },
]

export default function FlagPage() {
  return (
    <div className="space-y-8">
      <DocHeader
        title="العلم السوري"
        description="العلم السوري بالنسب الصحيحة (3:2)"
      />

      <div className="max-w-[600px]">
        <img src="/assets/syria-flag.svg" alt="العلم السوري" className="w-full rounded shadow-lg" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">ألوان العلم — Flag Colors</h2>
        <div className="flex gap-4 flex-wrap">
          {flagColors.map((c) => (
            <div key={c.hex} className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-md"
                style={{
                  backgroundColor: c.hex,
                  border: c.hex === "#ffffff" ? "1px solid #e0e0e0" : "none",
                }}
              />
              <div>
                <div className="text-sm">{c.name}</div>
                <div className="text-xs font-mono text-muted-foreground">{c.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">النسب — Proportions</h2>
        <p className="text-sm text-muted-foreground">العرض:الطول = 3:2 — 900×600</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">أحجام مختلفة — Sizes</h2>
        <div className="flex gap-4 flex-wrap items-end">
          {[200, 120, 60, 32].map((w) => (
            <div key={w} className="text-center">
              <img src="/assets/syria-flag.svg" alt="" style={{ width: w }} className="rounded shadow-sm" />
              <div className="text-xs text-muted-foreground mt-1">{w}px</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
