#!/usr/bin/env python3
"""Generate OpenGraph cards (1200x630 PNG) for the SEO head.

Two kinds of card:

  * Section cards  -> public/og/<slug>.png        (built-in list below)
  * Per-record     -> public/og/polls/<slug>.png
                      public/og/cities/<id>.png    (from the JSON manifest)

Run:
    python3 scripts/generate_og.py                       # section cards only
    php artisan seo:og-manifest | python3 scripts/generate_og.py   # + records

Requires playwright (`pip install playwright`) and a chromium (system chromium
is used by default; override with --executable).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"
OG = PUBLIC / "og"

SECTION_CARDS = {
    "home": ("المساحة السورية", "منصة سورية مفتوحة المصدر"),
    "tierlist": ("تير ليست الحكومة", "قيّم أداء الحكومة السورية"),
    "mishwar": ("مشوار", "دليل الأماكن والخدمات في سوريا"),
    "transit": ("ترانزيت سوريا", "خرائط وخطوط المواصلات العامة"),
    "syofficial": ("الحسابات الرسمية", "دليل الجهات الرسمية السورية"),
    "phonebook": ("دليل الهاتف", "أرقام الجهات الحكومية والخدمية"),
    "govapps": ("تطبيقات الحكومة", "دليل التطبيقات والخدمات الحكومية"),
    "sites": ("دليل المواقع", "مواقع ومنصات سورية مفيدة"),
    "party": ("دليل الأحزاب", "القوى السياسية والمدنية"),
    "house": ("المجلس التشريعي", "التشكيلة النهائية 2026"),
    "justice": ("العدالة الانتقالية", "قوائم وإحصائيات"),
    "crossings": ("المنافذ الحدودية", "الحالة الفنية وساعات العمل"),
    "atlas": ("أطلس سوريا", "بيانات سكانية وجغرافية تفاعلية"),
    "syid": ("الهوية البصرية", "ألوان وخطوط وعلم سوريا"),
    "muslim": ("الركن الإسلامي", "مواقيت، قرآن، وإذاعة"),
    "muslim-prayer": ("مواقيت الصلاة", "حسب مدينتك وطريقة الحساب"),
    "muslim-quran": ("قارئ القرآن", "بالرسم العثماني والتلاوة"),
    "roznama": ("الروزنامة السورية", "التقويم والأعياد والعطل الرسمية"),
    "priorities": ("أولويات سوريا", "رتّب أولوياتك وشاركها"),
    "compass": ("بوصلة سوريا", "اكتشف موقعك السياسي"),
    "promises": ("عداد الوعود", "وعود المسؤولين ومواعيدها وما تحقق منها"),
    "games": ("الألعاب", "2048، سوليتير، طرنيب، وتركس"),
    "guesswho": ("من هو؟", "لعبة التخمين المباشرة"),
    "board": ("لوحتي", "لوحة أدواتك اليومية"),
    "syrian-contributors": ("المساهمون", "أفضل المطورين السوريين على GitHub"),
    "shawarma": ("الشاورما", "تقييم محلات الشاورما"),
    "about": ("عن المنصة", "مشروع مفتوح المصدر"),
}

TEMPLATE = """<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; }
  body {
    font-family:'IBM Plex Sans Arabic', system-ui, sans-serif;
    background:
      radial-gradient(1200px 600px at 85% -10%, #1c4a34 0%, transparent 55%),
      radial-gradient(900px 500px at 0% 110%, #0f2a1e 0%, transparent 60%),
      #0a1a13;
    color:#f3f7f4; position:relative; overflow:hidden; padding:78px 84px;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .brand { display:flex; align-items:center; gap:16px; }
  .flag { width:58px; height:38px; border-radius:5px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.4); display:flex; flex-direction:column; }
  .flag i { display:block; flex:1; }
  .flag .g{background:#15803d} .flag .w{background:#ffffff; display:flex; align-items:center; justify-content:center; gap:7px}
  .flag .w b{width:9px;height:9px;background:#ce1126;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
  .flag .k{background:#111}
  .wordmark { font-weight:700; font-size:26px; letter-spacing:.5px; color:#cfe6d8; }
  .wordmark span { color:#7fd1a3; }
  .title { font-weight:700; font-size:82px; line-height:1.08; margin-bottom:22px; }
  .subtitle { font-weight:400; font-size:34px; color:#a9c6b6; max-width:900px; line-height:1.35; }
  .foot { display:flex; align-items:center; justify-content:space-between; color:#6f9a82; font-size:24px; font-weight:600; }
  .accent { position:absolute; top:0; inset-inline-start:0; width:14px; height:100%; background:linear-gradient(#34d399,#15803d); }
</style></head><body>
  <div class="accent"></div>
  <div class="brand">
    <div class="flag"><i class="g"></i><i class="w"><b></b><b></b><b></b></i><i class="k"></i></div>
    <div class="wordmark">SYRIAN <span>ZONE</span></div>
  </div>
  <div class="mid">
    <div class="title">__TITLE__</div>
    <div class="subtitle">__SUB__</div>
  </div>
  <div class="foot"><span>syrian.zone</span><span>المساحة السورية</span></div>
</body></html>"""


def html(title: str, sub: str) -> str:
    return TEMPLATE.replace("__TITLE__", title).replace("__SUB__", sub)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--executable", default="/usr/bin/chromium")
    args = ap.parse_args()

    # Manifest may arrive on stdin (piped from `php artisan seo:og-manifest`).
    manifest = {"polls": [], "cities": []}
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            manifest = json.loads(raw)

    jobs: list[tuple[Path, str, str]] = []
    for slug, (title, sub) in SECTION_CARDS.items():
        jobs.append((OG / f"{slug}.png", title, sub))
    for poll in manifest.get("polls", []):
        jobs.append((OG / "polls" / f"{poll['slug']}.png", poll["title"], "استطلاع رأي وتقييم مجتمعي"))
    for city in manifest.get("cities", []):
        jobs.append((OG / "cities" / f"{city['id']}.png", city["name"], "خطوط المواصلات والسرافيس"))

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=args.executable, args=["--no-sandbox"])
        page = await (await browser.new_context(viewport={"width": 1200, "height": 630})).new_page()
        for path, title, sub in jobs:
            path.parent.mkdir(parents=True, exist_ok=True)
            await page.set_content(html(title, sub), wait_until="networkidle")
            await page.evaluate("() => document.fonts.ready")
            await page.wait_for_timeout(120)
            await page.screenshot(path=str(path))
            print("wrote", path.relative_to(PUBLIC))
        await browser.close()

    print(f"done: {len(jobs)} cards")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
