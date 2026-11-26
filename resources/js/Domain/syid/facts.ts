import syidData from '../../../data/syid.json';

export interface SyidSource {
    id: string;
    label_ar: string;
    url: string;
}

export interface SyidPaletteColor {
    hex: string;
    hsl: string;
    cmyk: string;
    oklch: string;
    textColor: 'white' | 'black';
}

export interface SyidPalette {
    name: string;
    name_ar: string;
    colors: readonly SyidPaletteColor[];
}

export interface SyidDownloadFile {
    id: string;
    format: string;
    label_ar?: string;
    path: string;
    download_name: string;
    dimensions_ar: string;
    width?: number | null;
    height?: number | null;
    size_bytes: number;
    size_label: string;
}

export interface SyidLogoVariant {
    id: string;
    title_ar: string;
    description_ar: string;
    preview_path: string;
    preview_width: number;
    preview_height: number;
    preview_bg: 'light' | 'dark';
    alt_ar: string;
    downloads: readonly SyidDownloadFile[];
}

export interface SyidSourcedItem {
    id: string;
    title_ar: string;
    body_ar: string;
    source_label_ar: string;
    source_url: string;
}

export interface SyidFlagColor {
    name_ar: string;
    hex: string;
    rgb: string;
    hsl: string;
    textColor: 'white' | 'black';
}

export interface SyidWallpaper {
    id: string;
    title_ar: string;
    description_ar: string;
    preview_path: string;
    alt_ar: string;
    width: number;
    height: number;
    downloads: readonly SyidDownloadFile[];
}

export interface SyidFaqItem {
    id: string;
    question_ar: string;
    answer_ar: string;
    source_label_ar: string;
    source_url: string;
}

export interface SyidFacts {
    meta: {
        title_ar: string;
        official_site_url: string;
        official_site_note_ar: string;
        official_zip_path: string;
        sources: readonly SyidSource[];
    };
    palettes: readonly SyidPalette[];
    logo: {
        hero_image: {
            path: string;
            full_path: string;
            width: number;
            height: number;
            full_width: number;
            full_height: number;
            alt_ar: string;
            name_ar: string;
            caption_ar: string;
            credit_text: string;
            creator_name: string;
        };
        variants: readonly SyidLogoVariant[];
        symbolism: readonly SyidSourcedItem[];
        usage_rules: readonly SyidSourcedItem[];
    };
    flag: {
        emoji: string;
        hero_image: {
            path: string;
            full_path: string;
            width: number;
            height: number;
            full_width: number;
            full_height: number;
            alt_ar: string;
            name_ar: string;
            caption_ar: string;
            credit_text: string;
        };
        specs: {
            aspect_ratio: string;
            grid_width: number;
            grid_height: number;
            stripe_height: number;
            star_size: number;
            star_gap: number;
            star_side_margin: number;
            constitutional_article_ar: string;
            constitutional_source_url: string;
            diagram_aria_label_ar: string;
        };
        colors: readonly SyidFlagColor[];
        downloads: readonly SyidDownloadFile[];
        proportion_downloads: readonly SyidDownloadFile[];
        wallpapers: readonly SyidWallpaper[];
        guide: {
            title_ar: string;
            contributor_name_ar: string;
            contributor_url: string;
            note_ar: string;
            preview_path: string;
            preview_width: number;
            preview_height: number;
            alt_ar: string;
            pdf_url: string;
        };
        faq: readonly SyidFaqItem[];
    };
}

export const SYID_FACTS: SyidFacts = syidData as unknown as SyidFacts;
export const COLOR_PALETTES = SYID_FACTS.palettes;
export const FLAG_SPECS = SYID_FACTS.flag.specs;
export const FLAG_COLORS = SYID_FACTS.flag.colors;
