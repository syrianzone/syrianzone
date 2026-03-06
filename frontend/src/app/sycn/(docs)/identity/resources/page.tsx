import { DocHeader } from "@/components/sycn/docs/doc-header"

const downloads = [
  { name: "العلم السوري (SVG)", file: "/assets/syria-flag.svg" },
  { name: "خريطة سوريا (SVG)", file: "/assets/syria-map.svg" },
  { name: "الشعار (SVG)", file: "/assets/logo.svg" },
  { name: "الشعار — أبيض (SVG)", file: "/assets/logo-white.svg" },
  { name: "الرمز (SVG)", file: "/emblem.svg" },
]

const links = [
  {
    title: "البوابة الرسمية للهوية البصرية",
    titleEn: "Official Visual Identity Portal",
    url: "https://syrianidentity.sy",
    description: "الموقع الرسمي للهوية البصرية السورية",
  },
  {
    title: "المواد الإعلامية والصحفية",
    titleEn: "Media & Press Materials",
    url: "https://syrianidentity.sy/media-and-press",
    description: "تحميل المواد والموارد الرسمية",
  },
  {
    title: "حزمة الهوية البصرية",
    titleEn: "Identity Package (ZIP)",
    url: "https://syrianidentity.sy/media/2025-07-05/244/191b8f0d278fc2ab095fb4f344e3e9b4.zip",
    description: "الحزمة الكاملة للهوية البصرية",
  },
  {
    title: "خط قمرة — Qomra Font",
    titleEn: "Qomra Arabic Typeface",
    url: "https://iwantype.com",
    description: "الخط الرئيسي للهوية البصرية — خصم 25% بكود syrianzone",
  },
  {
    title: "المجموعة غير الرسمية",
    titleEn: "Unofficial Collection",
    url: "https://syrian.zone/syid",
    description: "مجموعة غير رسمية بانتظار إصدار الهوية الرسمية",
  },
]

export default function ResourcesPage() {
  return (
    <div className="space-y-8">
      <DocHeader
        title="المواد والموارد"
        description="المواد والموارد الرسمية للهوية البصرية السورية"
      />

      <div>
        <h2 className="text-lg font-semibold mb-3">الشعارات — Logos</h2>
        <div className="flex gap-8 flex-wrap items-center">
          <div className="p-6 bg-[#edebe0] rounded-xl">
            <img src="/assets/logo.svg" alt="الشعار" className="h-20" />
          </div>
          <div className="p-6 bg-[#161616] rounded-xl">
            <img src="/assets/logo-white.svg" alt="الشعار — أبيض" className="h-20" />
          </div>
          <div className="p-6 bg-[#edebe0] rounded-xl">
            <img src="/emblem.svg" alt="الرمز" className="h-20" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">التحميلات — Downloads</h2>
        <div className="space-y-2">
          {downloads.map((d) => (
            <a
              key={d.file}
              href={d.file}
              download
              className="flex items-center gap-3 p-3 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {d.name}
            </a>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">الروابط — Links</h2>
        <div className="space-y-3">
          {links.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="block p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="font-semibold text-[15px]">{r.title}</div>
              <div className="text-[13px] text-muted-foreground">{r.titleEn}</div>
              <div className="text-[13px] text-muted-foreground/70 mt-1">{r.description}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
