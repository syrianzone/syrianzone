#!/usr/bin/env node
/**
 * Download figure portraits for the compass and normalise them to square WebP.
 * Sources: Wikimedia/Wikipedia (any license) + documented public figures' official X avatars.
 * Run: node scripts/fetch-compass-figures.mjs
 *
 * Writes: public/images/compass/figures/<slug>.webp  (400x400)
 *         public/images/compass/figures/credits.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/images/compass/figures');
fs.mkdirSync(OUT, { recursive: true });

// name -> { slug, url, license, credit }
const FIGURES = {
  'فارس الخوري': { slug: 'fares-al-khoury', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Faris_al-Khoury.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'هاشم الأتاسي': { slug: 'hashim-al-atassi', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Hashim_Al_Atassi.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'شكري القوتلي': { slug: 'shukri-al-quwatli', url: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Portrait_of_Shukri_al-Quwatli_in_1943.jpeg', license: 'PD', credit: 'Wikimedia Commons' },
  'عبد الرحمن الشهبندر': { slug: 'shahbandar', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Shahbandar11.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'خالد العظم': { slug: 'khalid-al-azm', url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Khalid_al-Azm%2C_Syrian_politician.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'حسني الزعيم': { slug: 'husni-al-zaim', url: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Husni_al-Zaiim.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'أديب الشيشكلي': { slug: 'adib-al-shishakli', url: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Adib_al-Shishakli.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'ميشيل عفلق': { slug: 'michel-aflaq', url: 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Michel_Aflaq%2C_1960s.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'أكرم الحوراني': { slug: 'akram-al-hawrani', url: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Akram_Hourani.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'زكي الأرسوزي': { slug: 'zaki-al-arsuzi', url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/The_philosopher_Zaki_al-Arsuzi.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'أنطون سعادة': { slug: 'antoun-saadeh', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Antun_Saadeh.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'مصطفى السباعي': { slug: 'mustafa-al-sibai', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Mustafa_al-Siba%27i%2C_Syrian_islamic_politician_and_member_%28and_for_some_time_leader%29_of_the_Muslim_Brotherhood_in_Syria.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'مروان حديد': { slug: 'marwan-hadid', url: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/%D8%B5%D9%88%D8%B1%D8%A9_%D9%85%D8%B1%D9%88%D8%A7%D9%86_%D8%AD%D8%AF%D9%8A%D8%AF_1965.png', license: 'PD', credit: 'Wikimedia Commons' },
  'سعيد حوى': { slug: 'said-hawwa', url: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Said-Hawwa.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'رياض الترك': { slug: 'riad-al-turk', url: 'https://upload.wikimedia.org/wikipedia/en/1/1b/RiyadTurk.jpg', license: 'PD', credit: 'Wikipedia' },
  'ميشيل كيلو': { slug: 'michel-kilo', url: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Michel_Kilo.jpg', license: 'PD (US Gov)', credit: 'US State Department' },
  'ياسين الحاج صالح': { slug: 'yassin-al-haj-saleh', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Yassin_Al-Haj_Saleh_UAM.jpg', license: 'CC BY-SA 4.0', credit: 'Tamouz' },
  'مازن درويش': { slug: 'mazen-darwish', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/%D9%85%D8%A7%D8%B2%D9%86_%D8%AF%D8%B1%D9%88%D9%8A%D8%B4.jpg', license: 'CC BY-SA 4.0', credit: 'Che.syrian' },
  'مريم جلبي': { slug: 'mariam-jalabi', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Mariam_Jalabi%2C_Director_of_the_National_Liason_Office_for_the_United_Nations_%2816248319237%29_%28cropped%29.jpg', license: 'CC BY-SA 2.0', credit: 'Heinrich-Böll-Stiftung' },
  'هيثم المالح': { slug: 'haitham-al-maleh', url: 'https://upload.wikimedia.org/wikipedia/commons/6/61/%D8%B5%D9%88%D8%B1%D8%A9_%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9_%D9%87%D9%8A%D8%AB%D9%85_%D8%A7%D9%84%D9%85%D8%A7%D9%84%D8%AD.jpg', license: 'CC BY-SA 4.0', credit: 'Wikimedia Commons' },
  'نور الدين زازا': { slug: 'nureddin-zaza', url: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Noureddine_Zaza_1977.tiff', license: 'CC BY 3.0', credit: 'Gilberte Favre-Zaza' },
  'سلطان الأطرش': { slug: 'sultan-al-atrash', url: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Sultan_Pasha_Al-Atrash2.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'صالح العلي': { slug: 'saleh-al-ali', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Saleh_al-Ali.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  'عز الدين القسام': { slug: 'izz-al-din-al-qassam', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Izz_ad-Din_al-Qassam.jpg', license: 'PD', credit: 'Khalil Raad' },
  'مظلوم عبدي': { slug: 'mazloum-abdi', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Mezl%C3%BBm_Ebd%C3%AE.jpg', license: 'PD (VOA)', credit: 'VOA' },
  'حكمت الهجري': { slug: 'hikmat-al-hijri', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Sheikh_Hikmat_al-Hijri_reading_a_speech_in_2024.png', license: 'CC BY 3.0', credit: 'Wikimedia Commons' },
  'غزال غزال': { slug: 'ghazal-ghazal', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Sheikh_Ghazal1.jpg', license: 'CC BY 4.0', credit: 'Wikimedia Commons' },
  'هند قبوات': { slug: 'hind-kabawat', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Hind_Kabawat_2016_%28cropped%29.jpg', license: 'CC BY 4.0', credit: 'G. Boulougouris / EC' },
  'أسامة الرفاعي': { slug: 'osama-al-rifai', url: 'https://upload.wikimedia.org/wikipedia/commons/3/37/%D8%B5%D9%88%D8%B1%D8%A9_%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9_%D8%A7%D9%84%D8%B4%D9%8A%D8%AE_%D8%A3%D8%B3%D8%A7%D9%85%D8%A9_%D8%A7%D9%84%D8%B1%D9%81%D8%A7%D8%B9%D9%8A.jpg', license: 'CC BY-SA 4.0', credit: 'Wikimedia Commons' },
  // living figures — official X avatars (best-effort; may 404 if handle changed)
  'أحمد الشرع': { slug: 'ahmed-al-sharaa', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Ahmed_al-Sharaa%2C_President_of_Syria%2C_in_March_2026.jpg', license: 'CC BY 4.0', credit: 'MFA Ukraine' },
  'أسعد الشيباني': { slug: 'asaad-al-shaibani', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Asaad_al-Shaibani%2C_Foreign_Minister_of_Syria%2C_in_March_2026.jpg', license: 'CC BY 4.0', credit: 'Wikimedia Commons' },
};

const UA = 'Mozilla/5.0 (SyrianZone compass; contact hadi)';
const credits = [];

function dl(url, dest) {
  execFileSync('curl', ['-sL', '--fail', '-A', UA, '--max-time', '40', '-o', dest, url], { stdio: 'pipe' });
}

for (const [name, info] of Object.entries(FIGURES)) {
  const tmp = path.join('/tmp', `${info.slug}.src`);
  const out = path.join(OUT, `${info.slug}.webp`);
  try {
    dl(info.url, tmp);
    // square crop (center), 400x400 webp
    execFileSync('magick', [tmp, '-auto-orient', '-resize', '400x400^', '-gravity', 'center', '-extent', '400x400', '-quality', '82', out]);
    credits.push({ name, slug: info.slug, license: info.license, credit: info.credit, source: info.url });
    console.log('✓', name, '->', `${info.slug}.webp`);
  } catch (e) {
    console.log('✗', name, String(e.message || e).slice(0, 80));
  }
}

fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(credits, null, 2));
console.log(`\nDownloaded ${credits.length}/${Object.keys(FIGURES).length}`);
