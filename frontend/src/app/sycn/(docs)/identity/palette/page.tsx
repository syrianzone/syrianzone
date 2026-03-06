import { DocHeader } from "@/components/sycn/docs/doc-header"

const palettes = {
  Forest: [
    { name: "Forest Light", hex: "#428177", cmyk: "C76% M32% Y54% K10%" },
    { name: "Forest Mid", hex: "#054239", cmyk: "C89% M49% Y70% K50%" },
    { name: "Forest Dark", hex: "#002623", cmyk: "C87% M59% Y68% K71%" },
  ],
  "Golden Wheat": [
    { name: "Wheat Light", hex: "#edebe0", cmyk: "C6% M9% Y19% K0%" },
    { name: "Wheat Mid", hex: "#b9a779", cmyk: "C20% M29% Y52% K7%" },
    { name: "Wheat Dark", hex: "#988561", cmyk: "C39% M46% Y67% K20%" },
  ],
  "Deep Umber": [
    { name: "Umber Light", hex: "#6b1f2a", cmyk: "C35% M92% Y72% K46%" },
    { name: "Umber Mid", hex: "#4a151e", cmyk: "C44% M86% Y68% K65%" },
    { name: "Umber Dark", hex: "#260f14", cmyk: "C60% M75% Y64% K79%" },
  ],
  Charcoal: [
    { name: "White", hex: "#ffffff", cmyk: "C0% M0% Y0% K0%" },
    { name: "Charcoal Mid", hex: "#3d3a3b", cmyk: "C67% M53% Y60% K50%" },
    { name: "Charcoal Dark", hex: "#161616", cmyk: "C73% M67% Y65% K80%" },
  ],
}

export default function PalettePage() {
  return (
    <div className="space-y-8">
      <DocHeader
        title="لوحة الألوان"
        description="الألوان الرسمية للهوية البصرية السورية"
      />
      {Object.entries(palettes).map(([group, colors]) => (
        <div key={group}>
          <h2 className="text-lg font-semibold mb-3">{group}</h2>
          <div className="flex gap-4 flex-wrap">
            {colors.map((c) => (
              <div key={c.hex} className="w-[180px]">
                <div
                  className="w-full h-[100px] rounded-lg"
                  style={{
                    backgroundColor: c.hex,
                    border: c.hex === "#ffffff" ? "1px solid #e0e0e0" : "none",
                  }}
                />
                <div className="mt-2 text-sm font-semibold">{c.name}</div>
                <div className="text-[13px] font-mono">{c.hex}</div>
                <div className="text-xs text-muted-foreground">{c.cmyk}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
