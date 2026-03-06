import { DocHeader } from "@/components/sycn/docs/doc-header"

export default function MapPage() {
  return (
    <div className="space-y-8">
      <DocHeader
        title="خريطة سوريا"
        description="خريطة الجمهورية العربية السورية"
      />

      <div className="max-w-[500px]">
        <img src="/assets/syria-map.svg" alt="خريطة سوريا" className="w-full" />
      </div>

      <div className="flex gap-8 flex-wrap">
        <div>
          <h2 className="text-base font-semibold mb-2">مع ألوان الهوية — Identity Colors</h2>
          <div className="max-w-[300px] p-6 bg-primary rounded-xl">
            <img src="/assets/syria-map.svg" alt="" className="w-full brightness-0 invert opacity-90" />
          </div>
        </div>
        <div>
          <h2 className="text-base font-semibold mb-2">مع خلفية داكنة — Dark Background</h2>
          <div className="max-w-[300px] p-6 bg-[#161616] rounded-xl">
            <img src="/assets/syria-map.svg" alt="" className="w-full brightness-0 invert opacity-80" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2">المصادر — Sources</h2>
        <ul className="text-sm text-muted-foreground list-disc ps-5 space-y-1">
          <li>
            <a href="https://upload.wikimedia.org/wikipedia/commons/8/88/Blank_Syria_map.svg" target="_blank" rel="noreferrer" className="underline">
              Wikimedia — Blank Syria Map (SVG)
            </a>
          </li>
          <li>
            <a href="https://upload.wikimedia.org/wikipedia/commons/2/2d/Syria_physical_location_map.svg" target="_blank" rel="noreferrer" className="underline">
              Wikimedia — Syria Physical Map (SVG)
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
