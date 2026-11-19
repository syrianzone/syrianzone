# دليل رصد وتحديث التغييرات المنصبية والوزارية (`govtcvs`)

> **الهدف:** مرجع عملي قابل لإعادة الاستخدام للعثور على أحدث التعيينات والإعفاءات والتنقلات الوزارية والقيادية في سوريا من المصادر الرسمية الأولية (**وكالة سانا** و**الإخبارية السورية**)، والتحقق من نصوص المراسيم والأسماء العربية، وتطبيقها بدقة على قسم **السير الذاتية للمسؤولين** (`/govtcvs`) في موقع **المساحة السورية**.

---

## 1. خريطة المصادر الرسمية ونقاط الوصول المختبرة

### أولاً: الوكالة العربية السورية للأنباء (سانا — `sana.sy`) — *المصدر الأولي للمراسيم وبطاقات السير*

| المصدر | الرابط المباشر | المحتوى | الاستخدام |
| :--- | :--- | :--- | :--- |
| **خلاصة رئاسة الجمهورية (RSS)** | `https://sana.sy/presidency/feed/` | آخر ~150 خبراً رئاسياً (يشمل جميع المراسيم والقرارات الرئاسية) | **المصدر الأول** لاكتشاف أي مرسوم تعيين أو إعفاء أو تعديل وزاري |
| **خلاصة قسم الحكومة (RSS)** | `https://sana.sy/government/feed/` | بطاقات السير الذاتية الرسمية المهيكلة للمعيّنين الجدد | استخراج المؤهلات، سنة ومكان الولادة، والخبرات السابقة والاسم الرسمي |
| **بحث RSS عن المراسيم** | `https://sana.sy/?s=%D9%85%D8%B1%D8%B3%D9%88%D9%85&feed=rss2` | أحدث أخبار «مرسوم» في كل الأقسام (يشمل `locals` و`economy`) | التقاط المراسيم التي تُنشر أحياناً خارج تصنيف `presidency` (مثل `locals`) |
| **بحث RSS عن التعيينات الوزارية** | `https://sana.sy/?s=%D9%88%D8%B2%D9%8A%D8%B1%D8%A7%D9%8B&feed=rss2` | كل الأخبار التي تذكر تعيين «وزيراً» | رصد التعديلات الوزارية تحديداً |
| **بحث RSS عن التعيينات العامة** | `https://sana.sy/?s=%D8%AA%D8%B9%D9%8A%D9%8A%D9%86&feed=rss2` | تعيين معاونين، محافظين، رؤساء هيئات، وسفراء | رصد تعيينات الفئة الثانية (`deputy_minister`, `governor`, `agency_head`) |
| **قناة تيليغرام الرسمية** | `https://t.me/s/Sana_gov` (وللبحث: `?q=مرسوم`) | نشرات سانا الفورية | تأكيد سريع أو التقاط نصوص المراسيم لحظة صدورها |

> **ملاحظتان تقنيتان مهمتان حول `sana.sy`:**
> 1. واجهة `https://sana.sy/wp-json/wp/v2/posts` معطّلة رسمياً (`HTTP 401 rest_disabled`)، لذا يجب الاعتماد على **خلاصات RSS** أعلاه.
> 2. تحتوي خلاصات RSS في سانا حالياً على سمة XML مكررة في الترويسة (`xmlns:media="http://search.yahoo.com/mrss/"` مكررة مرتين)، مما يتسبب بفشل المحللات الصارمة مثل `xml.etree.ElementTree`. **الحل:** إزالة التكرار قبل التحليل أو استخدام `regex` / `lxml(recover=True)`.

---

### ثانياً: قناة الإخبارية السورية (`alikhbariah.com`) — *مصدر رسمي رديف بواجهة JSON مفتوحة*

| المصدر | الرابط المباشر | المحتوى | الاستخدام |
| :--- | :--- | :--- | :--- |
| **واجهة WordPress REST API (JSON)** | `https://alikhbariah.com/wp-json/wp/v2/posts` | جميع المقالات المهيكلة مع دعم `search` و`after` و`per_page` و`_fields` | **أسرع طريقة برمجية** للبحث بالتاريخ والكلمات المفتاحية وسحب النص الكامل للسير الذاتية |
| **خلاصة RSS العامة** | `https://alikhbariah.com/feed/` | أحدث أخبار الإخبارية السورية | مراقبة عامة |
| **قناة تيليغرام الرسمية** | `https://t.me/s/AlekhbariahSY` (وللبحث: `?q=مرسوم`) | الأخبار العاجلة ونصوص المراسيم المصوّرة | مطابقة التواريخ والأرقام عند تأخر أرشفة الموقع |

**استعلامات JSON جاهزة للإخبارية السورية (استبدل `SINCE` بتاريخ آخر تحديث بصيغة `YYYY-MM-DDT00:00:00`):**
- البحث عن المراسيم:
  `https://alikhbariah.com/wp-json/wp/v2/posts?search=%D9%85%D8%B1%D8%B3%D9%88%D9%85&after=SINCE&per_page=20&_fields=id,date,link,title`
- البحث عن التعيينات:
  `https://alikhbariah.com/wp-json/wp/v2/posts?search=%D8%AA%D8%B9%D9%8A%D9%8A%D9%86&after=SINCE&per_page=20&_fields=id,date,link,title`
- البحث عن التعيينات الوزارية والسير الذاتية المرافقة لها:
  `https://alikhbariah.com/wp-json/wp/v2/posts?search=%D9%88%D8%B2%D9%8A%D8%B1%D8%A7%D9%8B&after=SINCE&per_page=20&_fields=id,date,link,title`

> **ملاحظتان تقنيتان مهمتان حول `alikhbariah.com`:**
> 1. استخدم النطاق الأساسي `https://alikhbariah.com` **بدون `www.`**؛ لأن شهادة SSL على `www.alikhbariah.com` غير مطابقة للاسم.
> 2. قد تُرجع الصفحة الرئيسية `/` رمز `403` لطلبات السكربتات، بينما تعمل `/wp-json/wp/v2/posts` و`/feed/` برمز `200 OK` مباشرة عند تمرير `User-Agent` قياسي.

---

## 2. سكربت الفحص السريع (تشغيل بسطر واحد)

يمكن تشغيل السكربت التالي من جذر المشروع لاكتشاف جميع المراسيم والتعيينات وبطاقات السير الجديدة منذ تاريخ محدد (مثلاً `SINCE=2026-11-01`):

```bash
SINCE="2026-11-01" python3 - <<'PY'
import os, re, html, json, urllib.request, urllib.parse
from datetime import datetime
from email.utils import parsedate_to_datetime

since_str = os.environ.get("SINCE", "2026-11-01")
since_dt = datetime.fromisoformat(since_str)
headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
keywords = ("مرسوم", "تعيين", "وزير", "معاون", "نائب", "محافظ", "مستشار", "رئيس هيئة", "إعفاء", "تكليف", "مدير عام")

def clean_cdata(val: str) -> str:
    val = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", val, flags=re.S)
    return html.unescape(val).strip()

def scan_sana_rss(label: str, url: str, filter_kw: bool = True):
    print(f"\n=== {label} ===")
    req = urllib.request.Request(url, headers=headers)
    text = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
    for block in re.findall(r"<item>(.*?)</item>", text, re.S):
        t_m = re.search(r"<title>(.*?)</title>", block, re.S)
        l_m = re.search(r"<link>(.*?)</link>", block, re.S)
        d_m = re.search(r"<pubDate>(.*?)</pubDate>", block, re.S)
        if not (t_m and l_m and d_m):
            continue
        title = clean_cdata(t_m.group(1))
        link = l_m.group(1).strip()
        pub_dt = parsedate_to_datetime(d_m.group(1).strip()).replace(tzinfo=None)
        if pub_dt < since_dt:
            continue
        if filter_kw and not any(k in title for k in keywords):
            continue
        print(f"  [{pub_dt.strftime('%Y-%m-%d %H:%M')}] {title}\n    {link}")

scan_sana_rss("سانا — رئاسة الجمهورية (مراسيم وتعيينات)", "https://sana.sy/presidency/feed/", filter_kw=True)
scan_sana_rss("سانا — قسم الحكومة (بطاقات السير الذاتية الجديدة)", "https://sana.sy/government/feed/", filter_kw=False)
scan_sana_rss("سانا — بحث عام (مرسوم)", "https://sana.sy/?s=" + urllib.parse.quote("مرسوم") + "&feed=rss2", filter_kw=True)

print("\n=== الإخبارية السورية (WP REST API) ===")
seen = set()
for q in ("مرسوم", "تعيين", "وزيراً"):
    url = (
        f"https://alikhbariah.com/wp-json/wp/v2/posts?"
        f"search={urllib.parse.quote(q)}&after={since_str}T00:00:00&per_page=20&_fields=id,date,link,title"
    )
    req = urllib.request.Request(url, headers=headers)
    posts = json.loads(urllib.request.urlopen(req, timeout=15).read().decode("utf-8"))
    for p in posts:
        if p["id"] in seen:
            continue
        title = html.unescape(p["title"]["rendered"]).strip()
        if not any(k in title for k in keywords):
            continue
        seen.add(p["id"])
        print(f"  [{p['date'][:16]}] {title}\n    {p['link']}")
PY
```

---

## 3. منهجية التحقق قبل إدخال أي تحديث

قبل تعديل أي ملف أو سجل في قاعدة البيانات، يجب تطبيق القواعد الخمس التالية:

1. **التحقق من المصدر الأصلي وتجنب الوثائق المزوّرة:**
   - لا يُعتمد أي مرسوم متداول على وسائل التواصل إلا بوجود رابط مباشر منشور على `sana.sy` أو `alikhbariah.com` (ظهرت سابقاً وثائق مفبركة تحمل شعارَي سانا والإخبارية).
2. **نقل الاسم واللقب حرفياً من نص المرسوم:**
   - اعتمد الاسم الكامل الوارد في المادة الأولى من المرسوم (مثال: `أحمد رواد محمد بشار رمضان` وليس اسماً ناقصاً).
   - راجع اللقب الرسمي بدقة (`الدكتور`، `المهندس`، `القاضي`، `الشيخ الدكتور`، `الأستاذ`، `السفير`، `اللواء`...)؛ انتبه لعدم التباس كلمة «القاضي» في صيغة *«المرسوم القاضي بتعيين...»* مع لقب الشخص.
   - لا تُضف أخطاء النسخ أو الـ OCR كـ `aliases`.
3. **التمييز بين الترقية/النقل وبين الجمع بين منصبين:**
   - إذا ورد في المرسوم عبارة **«إضافةً إلى عمله...»** (مثال: المرسوم 203 لعام 2026 بتعيين أحمد رواد رمضان وزيراً للاقتصاد والتجارة الخارجية *إضافة إلى عمله رئيساً لهيئة الاستثمار السورية*)، تبقى الولايتان بحالة `current` مع رفع `highest_tier` إلى الرتبة الأعلى (`minister`).
   - إذا حلّ مسؤول جديد محل مسؤول سابق في شاغر مفرد (`is_single_seat: true`)، يجب إنهاء ولاية السلف (`status: "ended"`, `ended_at`, `end_reason` من القائمة المعتمدة مثل `reassigned` أو `replaced` أو `promoted`، و`end_decree_ref`).
4. **مراجعة الشواغر الوزارية عند الدمج أو الفصل (`office_slots`):**
   - عند استحداث وزارة أو فصل حقيبة (مثل فصل «الصناعة والتجارة الداخلية وحماية المستهلك» بالمرسوم 189 ثم إعادة تسمية «الاقتصاد والتجارة الخارجية» بالمرسوم 203)، حدّث حالة الشاغر في `office_slots` (`active` / `merged` / `abolished`) واربطه بـ `institution_id` الصحيح من `official_entities`.
5. **سحب بطاقة السيرة الذاتية والصورة الرسمية:**
   - تحقق دوماً من `https://sana.sy/government/feed/` ومقالات السيرة على `alikhbariah.com` (تُنشر غالباً خلال 24 ساعة من صدور المرسوم) لتعبئة `bio_summary_ar` و`cv_entries` وترقية `cv_completeness` إلى `full_cv`.
   - للصورة الشخصية: احفظها بصيغة WebP مربعة (512×512 بكسل مع قص محكم للوجه والكتفين) في `public/images/govtcvs/{slug}.webp`.

---

## 4. طرق تطبيق التحديثات على الموقع

### المسار أ — التحديث المباشر عبر أدوات الوكيل (MCP) أو لوحة الإدارة *(موصى به للإنتاج)*
- عبر لوحة الإدارة: `/admin/govtcvs` (أو `/admin/govtcvs/slots` لإضافة شاغر جديد).
- أو عبر أدوات MCP المخصصة في `app/Mcp/Tools/GovtCvs/`:
  1. `list-govt-officials` / `get-govt-official` للتحقق مما إذا كان المسؤول موجوداً مسبقاً (مثال: معاون وزير أو رئيس هيئة رُقّي إلى وزير).
  2. `save-govt-slot` لإنشاء أو تحديث الشاغر الوظيفي.
  3. `update-govt-tenure` لإنهاء ولاية السلف (مع `end_reason` و`end_decree_ref`).
  4. `create-govt-official` (إن كان جديداً) أو `update-govt-official` لتحديث السيرة والمستوى (`highest_tier`).
  5. `add-govt-tenure` لإضافة الولاية الجديدة مع رقم المرسوم وتاريخه (`start_decree_ref`, `started_at`).
  6. `upsert-govt-cv-entry` لإضافة محطات التعليم والخبرات من بطاقة سانا أو الإخبارية.
  7. `add-govt-evidence` لتوثيق روابط سانا والإخبارية داخلياً في لوحة الإدارة.
  8. `publish-govt-official` عند جاهزية ملف جديد للنشر.

### المسار ب — التحديث في ملف البيانات المصدري بالمستودع *(للحفاظ على تزامن الـ Seeder)*
1. حدّث [`database/seeders/data/govtcvs_research.json`](../../database/seeders/data/govtcvs_research.json) (الشواغر + المسؤولين + الولايات + السيرة + روابط التوثيق).
2. شغّل أمر الاستيراد الآمن (Idempotent):
   ```bash
   php artisan govtcvs:import-research
   ```
   *(أو عند تعديل ولايات منتهية على بيئة التطوير المحلية، أعد تطبيق هجرتي القسم عبر `php artisan migrate:rollback --step=2 --force && php artisan migrate --force`).*
3. شغّل الاختبارات للتحقق من سلامة البيانات والربط التلقائي:
   ```bash
   php artisan test tests/Feature/GovtCvs/ tests/Feature/Agent/GovtCvsToolsTest.php
   ```
4. تصفّح `/govtcvs/movements` وصفحات المسؤولين المحدّثين للتأكد من ظهور التسلسل الزمني والربط بين السلف والخلف.

---

## 5. قالب أمر جاهز لإعادة الاستخدام مستقبلاً

عند الرغبة بتحديث الموقع لاحقاً، يكفي توجيه الوكيل الذكي بالأمر التالي:

> «اتّبع دليل [`docs/modules/govtcvs-official-updates-playbook.md`](govtcvs-official-updates-playbook.md) وابحث في سانا والإخبارية السورية عن جميع المراسيم والتغييرات الوزارية والمنصبية منذ تاريخ `YYYY-MM-DD` حتى اليوم، اعرض عليّ ملخص التغييرات مع روابط المصادر الرسمية، ثم حدّث `database/seeders/data/govtcvs_research.json` وقاعدة البيانات وتحقّق بالاختبارات.»

---

## 6. سجل آخر مراجعة رسمية منفّذة

- **تاريخ المراجعة:** 19 تشرين الثاني 2026
- **التغييرات الوزارية المرصودة والمطبّقة:**
  1. **المرسوم الرئاسي رقم (202) لعام 2026** (18 تشرين الثاني 2026 — [سانا](https://sana.sy/presidency/2638732/)): تعيين الدكتور **محمد نضال الشعار** مستشاراً للشؤون الاقتصادية والمالية لدى رئاسة الجمهورية، وإنهاء ولايته وزيراً للاقتصاد.
  2. **المرسوم الرئاسي رقم (203) لعام 2026** (18 تشرين الثاني 2026 — [سانا](https://sana.sy/presidency/2638733/)، والسيرة الذاتية عبر [الإخبارية السورية](https://alikhbariah.com/%d9%85%d9%86-%d9%87%d9%8a%d8%a6%d8%a9-%d8%a7%d9%84%d8%a7%d8%b3%d8%aa%d8%ab%d9%85%d8%a7%d8%b1-%d8%a5%d9%84%d9%89-%d9%88%d8%b2%d8%a7%d8%b1%d8%a9-%d8%a7%d9%84%d8%a7%d9%82%d8%aa%d8%b5%d8%a7%d8%af-%d9%85/)): تعيين المهندس **أحمد رواد محمد بشار رمضان** وزيراً للاقتصاد والتجارة الخارجية، إضافةً إلى عمله رئيساً لهيئة الاستثمار السورية.
- **تعيينات إضافية رُصدت في أرشيف سانا الحكومي (قيد النظر للإضافة في دفعة قادمة):**
  - **مزنا ممدوح الأطرش** — مستشارة شؤون السلام في وزارة الخارجية ([بطاقة سانا — 2 تشرين الثاني 2026](https://sana.sy/government/2624173/)).
  - **عمر سامر الحلبي** — مستشار الشؤون الاقتصادية لدى رئاسة الجمهورية ورئيس مجلس إدارة الصندوق السيادي ([بطاقة سانا — 18 تشرين الأول 2026](https://sana.sy/government/2610304/)).
