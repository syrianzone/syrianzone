import { normalizeArabic } from '@/Lib/arabic';
import { SYRIAN_MONTHS_AR } from '@/Lib/syrian-date';
import { shareOrCopy } from '@/Lib/webShare';
import { MEDIA_BASE } from '@/Domain/govapps/media';

/**
 * The wildlife guide (/wild): the types of `resources/data/wildlife.json`
 * plus its label tables. The data itself is not bundled: the server
 * (`App\Services\Wildlife\WildlifeData`) passes each page only the records it
 * renders, so every fact is still edited once. `tests/Feature/WildlifeDataTest.php`
 * holds the file to the sourcing rules in `docs/modules/wildlife.md`.
 */

export const GROUPS = ['mammal', 'bird', 'reptile', 'amphibian', 'fish', 'invertebrate'] as const;
export type Group = (typeof GROUPS)[number];

export const IUCN_CATEGORIES = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'] as const;
export type IucnCategory = (typeof IUCN_CATEGORIES)[number];

export const SYRIA_STATUSES = [
    'resident',
    'breeding-visitor',
    'passage-migrant',
    'winter-visitor',
    'uncertain',
    'possibly-extinct',
    'extinct-in-syria',
] as const;
export type SyriaStatus = (typeof SYRIA_STATUSES)[number];

export const HABITATS = ['steppe', 'mountains', 'farmland', 'wetlands', 'coast'] as const;
export type Habitat = (typeof HABITATS)[number];

/** A fact or a threat, and the indexes into the species' `sources` that back it. */
export interface CitedText {
    text: string;
    sources: number[];
}

export interface Source {
    title: string;
    url: string;
}

export interface SpeciesImage {
    /** File name on Wikimedia Commons, without the `File:` prefix. */
    commonsFile: string;
    author: string;
    license: string;
    /** Null for a public-domain photo, which has no license to link. */
    licenseUrl: string | null;
    captionAr: string;
    /** Key in the R2 media store once the photo is mirrored (`wildlife:mirror-images`). */
    r2Key: string | null;
}

export interface Species {
    slug: string;
    nameAr: string;
    altNamesAr: string[];
    nameEn: string;
    scientific: string;
    subspecies?: string;
    group: Group;
    iucn: { category: IucnCategory; url: string };
    iucnNoteAr?: string;
    syriaStatus: SyriaStatus;
    statusNoteAr?: string;
    habitats: Habitat[];
    /** Governorate ids (`resources/data/governorates.json`) with documented records, past or recent. */
    governorates: string[];
    summaryAr: string;
    summarySources: number[];
    factsAr: CitedText[];
    threatsAr: CitedText[];
    image: SpeciesImage;
    sources: Source[];
    /** ISO date of the last review against the sources. */
    lastReviewed: string;
}

/** What a card in a grid gets from the server (`WildlifeData::card`). */
export type SpeciesCardData = Pick<
    Species,
    'slug' | 'nameAr' | 'altNamesAr' | 'nameEn' | 'scientific' | 'subspecies' | 'group' | 'syriaStatus'
> & {
    iucn: Pick<Species['iucn'], 'category'>;
    image: Pick<SpeciesImage, 'commonsFile' | 'r2Key'>;
};

/** Props of `Wild/Index` (`WildlifeData::forHub`). */
export interface WildHubProps {
    species: SpeciesCardData[];
    stats: { total: number; threatened: number; sources: number };
    sources: Source[];
}

/** Props of `Wild/Show` (`WildlifeData::forSpecies`). */
export interface WildShowProps {
    species: Species;
    related: SpeciesCardData[];
}

/** A species recorded in a governorate, as its page lists it (`WildlifeData::forGovernorate`). */
export interface GovernorateSpecies {
    slug: string;
    nameAr: string;
    group: Group;
    syriaStatus: SyriaStatus;
    historical: boolean;
    url: string;
}

export const GROUP_LABELS: Record<Group, string> = {
    mammal: 'الثدييات',
    bird: 'الطيور',
    reptile: 'الزواحف',
    amphibian: 'البرمائيات',
    fish: 'الأسماك',
    invertebrate: 'اللافقاريات',
};

/** The singular, for a species' own badge. */
export const GROUP_LABEL_ONE: Record<Group, string> = {
    mammal: 'من الثدييات',
    bird: 'من الطيور',
    reptile: 'من الزواحف',
    amphibian: 'من البرمائيات',
    fish: 'من الأسماك',
    invertebrate: 'من اللافقاريات',
};

/** The Red List categories, in the Arabic wording most Arabic references use. */
export const IUCN_LABELS: Record<IucnCategory, string> = {
    EX: 'منقرض',
    EW: 'منقرض في البرية',
    CR: 'مهدد بشدة بالانقراض',
    EN: 'مهدد بالانقراض',
    VU: 'معرّض للانقراض',
    NT: 'قريب من التهديد',
    LC: 'غير مهدد',
    DD: 'بيانات غير كافية',
    NE: 'غير مقيَّم',
};

/** CR, EN and VU are the Red List's "threatened" categories. */
export function isThreatened(category: IucnCategory): boolean {
    return category === 'CR' || category === 'EN' || category === 'VU';
}

export const STATUS_LABELS: Record<SyriaStatus, string> = {
    resident: 'مقيم',
    'breeding-visitor': 'زائر للتكاثر',
    'passage-migrant': 'عابر في الهجرة',
    'winter-visitor': 'زائر شتوي',
    uncertain: 'وجوده غير مؤكد',
    'possibly-extinct': 'يُرجَّح انقراضه في سوريا',
    'extinct-in-syria': 'منقرض في سوريا',
};

export const HABITAT_LABELS: Record<Habitat, string> = {
    steppe: 'البادية والسهوب',
    mountains: 'الجبال والغابات',
    farmland: 'الأراضي الزراعية',
    wetlands: 'الأنهار والأراضي الرطبة',
    coast: 'الساحل والبحر',
};

/**
 * Widths the photo is available in, from Wikimedia's standard thumbnail sizes.
 * `wildlife:mirror-images` stores the R2 copy at each of them: the largest at
 * the recorded `r2Key` (`wildlife/{slug}.jpg`), the others beside it
 * (`wildlife/{slug}-500.jpg`, `-960.jpg`). Keep the two lists in step.
 */
export const IMAGE_WIDTHS = [500, 960, 1280] as const;

/** The R2 key of the copy at `width`, from the full-size key the data records. */
function r2Variant(key: string, width: number): string {
    const fit = IMAGE_WIDTHS.find((w) => w >= width) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
    return fit === IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1] ? key : key.replace(/\.jpg$/, `-${fit}.jpg`);
}

/** Where the species' photo is served from: the R2 mirror once made, Commons until then. */
export function imageUrl(image: Pick<SpeciesImage, 'commonsFile' | 'r2Key'>, width = 960): string {
    if (image.r2Key) return `${MEDIA_BASE}/${r2Variant(image.r2Key, width)}`;
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image.commonsFile)}?width=${width}`;
}

/** A `srcSet` over every available width, for a responsive `<img>`. */
export function imageSrcSet(image: Pick<SpeciesImage, 'commonsFile' | 'r2Key'>): string {
    return IMAGE_WIDTHS.map((w) => `${imageUrl(image, w)} ${w}w`).join(', ');
}

/**
 * An ISO date ("2026-11-27") as "27 تشرين الثاني 2026", from a fixed month
 * table so the server render and the browser print the same text.
 */
export function formatReviewDate(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${SYRIAN_MONTHS_AR[month - 1]} ${year}`;
}

/** The photo's page on Commons, where its author and license are recorded. */
export function imageSourceUrl(image: SpeciesImage): string {
    return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(image.commonsFile.replace(/ /g, '_'))}`;
}

/** Every spelling a search should match: both names, the alternatives and the scientific name. */
export function searchKey(s: SpeciesCardData): string {
    return normalizeArabic([s.nameAr, ...s.altNamesAr, s.nameEn, s.scientific, s.subspecies ?? ''].join(' '));
}

/** A prefilled GitHub issue for a correction, naming the species and its review date. */
export function correctionUrl(s: Species): string {
    const title = `تصحيح معلومة: ${s.nameAr} (${s.scientific})`;
    const body = `الصفحة: https://syrian.zone/wild/${s.slug}\nآخر مراجعة: ${s.lastReviewed}\n\nالمعلومة التي تحتاج إلى تصحيح:\n\nالمصدر الذي يدعم التصحيح (رابط):\n`;
    return `https://github.com/syrianzone/syrianzone/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

export function shareSpecies(s: Species) {
    return shareOrCopy(
        {
            title: s.nameAr,
            text: `${s.nameAr} — ${STATUS_LABELS[s.syriaStatus]} | دليل الحياة البرية في سوريا`,
            url: `${window.location.origin}/wild/${s.slug}`,
        },
        { successMessage: 'تم نسخ رابط الصفحة', failureMessage: 'تعذّرت مشاركة الصفحة' },
    );
}
