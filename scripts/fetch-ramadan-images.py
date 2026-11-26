#!/usr/bin/env python3
"""Download SANA Ramadan/landmark photos for Syrian governorates and encode as WebP."""

from __future__ import annotations

import json
import os
import urllib.request
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "images" / "ramadan"
META_PATH = ROOT / "resources" / "data" / "ramadan-images.json"

MAX_WIDTH = 1200
TARGET_MAX_BYTES = 150 * 1024
CREDIT_AR = "الوكالة العربية السورية للأنباء (سانا)"

SOURCES = [
    {
        "id": "damascus",
        "alt_ar": "رحاب الجامع الأموي الكبير في دمشق خلال شهر رمضان المبارك",
        "caption_ar": "أجواء روحانية في الجامع الأموي الكبير بدمشق خلال شهر رمضان المبارك",
        "source_article_url": "https://sana.sy/photos/2419060/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_2026-03-05_17-29-12-2.jpg",
    },
    {
        "id": "rural-damascus",
        "alt_ar": "صلاة التراويح في مسجد البغدادي بمدينة دوما في ريف دمشق",
        "caption_ar": "صلاة التراويح في مسجد البغدادي بمدينة دوما في ريف دمشق",
        "source_article_url": "https://sana.sy/photos/2409543/",
        "source_image_url": "https://cdn.sananews.sy/2026/02/photo_2026-02-21_20-57-39.jpg",
    },
    {
        "id": "aleppo",
        "alt_ar": "الجامع الأموي الكبير في حلب القديمة بعد إعادة تأهيله وافتتاحه",
        "caption_ar": "إقامة أول صلاة جمعة في الجامع الأموي الكبير بحلب بعد إعادة افتتاحه",
        "source_article_url": "https://sana.sy/governorates/aleppo/2601973/",
        "source_image_url": "https://cdn.sananews.sy/2026/10/0A4A0086-scaled.jpg",
    },
    {
        "id": "homs",
        "alt_ar": "جامع الصحابي خالد بن الوليد في حمص مزيناً لاستقبال شهر رمضان المبارك",
        "caption_ar": "جامع خالد بن الوليد في حمص بعد تزيينه بمناسبة قدوم شهر رمضان المبارك",
        "source_article_url": "https://sana.sy/photos/2407785/",
        "source_image_url": "https://cdn.sananews.sy/2026/02/ns47AI4c-0-4.jpg",
    },
    {
        "id": "hama",
        "alt_ar": "إحياء ليلة القدر في مسجد العلامة محمد الحامد بمدينة حماة",
        "caption_ar": "إحياء ليلة السابع والعشرين من رمضان في مسجد العلامة محمد الحامد بمدينة حماة",
        "source_article_url": "https://sana.sy/photos/2428070/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_1_2026-03-17_02-37-01.jpg",
    },
    {
        "id": "latakia",
        "alt_ar": "مسجد في ريف اللاذقية بعد إعادة تأهيله وافتتاحه للمصلين",
        "caption_ar": "مسجد قرية شير قبوع في ريف اللاذقية بعد إعادة تأهيله",
        "source_article_url": "https://sana.sy/governorates/latakia/2408738/",
        "source_image_url": "https://cdn.sananews.sy/2026/02/IMG_9807-scaled.jpg",
    },
    {
        "id": "tartus",
        "alt_ar": "مسجد قرية المرقب التاريخي في ريف طرطوس",
        "caption_ar": "مسجد قرية المرقب بريف طرطوس ومعالمه التاريخية والعمرانية",
        "source_article_url": "https://sana.sy/governorates/tartus/2411806/",
        "source_image_url": "https://cdn.sananews.sy/2026/02/IMG_3592-scaled.jpg",
    },
    {
        "id": "deir-ez-zor",
        "alt_ar": "صلاة التراويح في مسجد العرفي بمدينة دير الزور",
        "caption_ar": "صلاة التراويح من مسجد العرفي في مدينة دير الزور",
        "source_article_url": "https://sana.sy/photos/2425428/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_2026-03-13_21-40-40.jpg",
    },
    {
        "id": "idlib",
        "alt_ar": "المصلون في المسجد الكبير بمدينة معرة النعمان في ريف إدلب",
        "caption_ar": "المصلون في المسجد الكبير بمعرة النعمان في ريف إدلب",
        "source_article_url": "https://sana.sy/photos/2430785/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_1_2026-03-20_09-14-50.jpg",
    },
    {
        "id": "daraa",
        "alt_ar": "أجواء رمضانية في الجامع العمري بدرعا البلد",
        "caption_ar": "إحياء ليلة السابع والعشرين من رمضان في الجامع العمري بدرعا البلد",
        "source_article_url": "https://sana.sy/photos/2428138/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_2026-03-17_05-17-28.jpg",
    },
    {
        "id": "quneitra",
        "alt_ar": "سوق خان أرنبة في ريف القنيطرة خلال شهر رمضان المبارك",
        "caption_ar": "أسواق بلدة خان أرنبة في ريف القنيطرة خلال شهر رمضان المبارك",
        "source_article_url": "https://sana.sy/photos/2409873/",
        "source_image_url": "https://cdn.sananews.sy/2026/02/000-10.jpg",
    },
    {
        "id": "sweida",
        "alt_ar": "الشارع الحجري الأثري في مدينة شهبا بمحافظة السويداء",
        "caption_ar": "الشارع الحجري المبلط في شهبا بالسويداء، معلم أثري عريق",
        "source_article_url": "https://sana.sy/governorates/alsoaydaa/2202798/",
        "source_image_url": "https://cdn.sananews.sy/2025/03/photo_2025-03-28_16-14-39.jpg",
    },
    {
        "id": "hasakah",
        "alt_ar": "أجواء روحانية في المساجد السورية خلال شهر رمضان المبارك",
        "caption_ar": "مشهد رمضاني من المساجد السورية — صورة مرجعية من سانا",
        "source_article_url": "https://sana.sy/photos/2419060/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_2026-03-05_17-29-12-2.jpg",
    },
    {
        "id": "raqqa",
        "alt_ar": "أجواء روحانية في المساجد السورية خلال شهر رمضان المبارك",
        "caption_ar": "مشهد رمضاني من المساجد السورية — صورة مرجعية من سانا",
        "source_article_url": "https://sana.sy/photos/2419060/",
        "source_image_url": "https://cdn.sananews.sy/2026/03/photo_2026-03-05_17-29-12-2.jpg",
    },
]


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def encode_webp(raw: bytes, dest: Path) -> tuple[int, int, int]:
    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img).convert("RGB")
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, round(img.height * ratio)), Image.Resampling.LANCZOS)

    best_buf = None
    for quality in (82, 75, 68, 60, 52, 44):
        buf = BytesIO()
        img.save(buf, format="WEBP", quality=quality, method=6)
        best_buf = buf.getvalue()
        if len(best_buf) <= TARGET_MAX_BYTES:
            break

    assert best_buf is not None
    dest.write_bytes(best_buf)
    return img.width, img.height, len(best_buf)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    for entry in SOURCES:
        gid = entry["id"]
        raw = download_bytes(entry["source_image_url"])
        dest = OUT_DIR / f"{gid}.webp"
        width, height, size = encode_webp(raw, dest)
        print(f"{gid:15s} {width}x{height} {size // 1024:3d} KB <- {entry['source_image_url']}")
        records.append({
            "id": gid,
            "file": f"/images/ramadan/{gid}.webp",
            "width": width,
            "height": height,
            "alt_ar": entry["alt_ar"],
            "caption_ar": entry["caption_ar"],
            "source_article_url": entry["source_article_url"],
            "source_image_url": entry["source_image_url"],
            "credit_ar": CREDIT_AR,
        })

    META_PATH.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {META_PATH} ({len(records)} records)")


if __name__ == "__main__":
    main()
