export interface PopulationInfo {
    value: number;
    year: string | null;
    source_url: string | null;
    note: string | null;
}

export interface IconCredit {
    name_ar: string;
    x_url: string;
    instagram_url: string;
}

export interface SvgMapShape {
    id: string;
    name_ar: string;
    path: string;
    label_x: number;
    label_y: number;
}

export interface SvgMapData {
    viewBox: string;
    width: number;
    height: number;
    shapes: SvgMapShape[];
}

export interface GovernorateHubItem {
    id: string;
    name_ar: string;
    name_en: string;
    pcode: string;
    centre_ar: string;
    area_sqkm: number | null;
    icon_path: string | null;
    landmark_ar: string | null;
    population: PopulationInfo | null;
}

export interface GovernoratesHubProps {
    governorates: GovernorateHubItem[];
    populationMeta: {
        year: string | null;
        source_url: string | null;
        note: string | null;
        total: number;
    } | null;
    svgMap: SvgMapData;
    iconCredit: IconCredit;
}

export interface GovernorateOfficial {
    name_ar: string;
    title_ar: string;
    start_date: string | null;
    decree: string | null;
    notes_ar: string | null;
    slug: string | null;
    portrait_url: string | null;
    source_label_ar: string;
    source_url: string | null;
}

export interface GovernorateDeputy {
    name_ar: string;
    title_ar: string;
    role_kind: string;
    slug: string | null;
    portrait_url: string | null;
    source_label_ar: string;
    source_url: string | null;
}

export interface GovernorateOfficialsData {
    governor: GovernorateOfficial | null;
    deputies: GovernorateDeputy[];
    jard_credit: {
        name_ar: string;
        url: string;
        as_of: string;
    } | null;
}

export interface GovernoratePrayerData {
    timings: Record<string, string>;
    hijri: {
        day: string;
        month: string;
        year: string;
    } | null;
    today: {
        iso: string;
        gregorian_ar: string;
    };
    prayer_url: string;
    ramadan_url: string | null;
}

export interface GovernorateTransitData {
    city_id: string;
    city_name_ar: string;
    routes_count: number;
    map_url: string;
    routes: Array<{
        id: string;
        name_ar: string;
        stops_count: number | null;
        price_new: number | null;
        url: string;
    }>;
}

export interface GovernorateCrossingItem {
    n: number;
    slug: string;
    name: string;
    category: string;
    country: string | null;
    op_type: string | null;
    opening_soon: boolean;
    url: string;
}

export interface GovernoratePlacesData {
    total: number;
    categories: Array<{
        key: string;
        label: string;
        count: number;
    }>;
    notable: Array<{
        id: number;
        name: string;
        category: string;
        category_label: string;
        description: string | null;
        url: string;
    }>;
}

export interface GovernoratePhonebookItem {
    id: string;
    name_ar: string;
    category_ar: string;
    number: string;
    is_whatsapp: boolean;
    source_url: string | null;
}

export interface OtherGovernorateLink {
    id: string;
    name_ar: string;
    centre_ar: string;
    icon_path: string | null;
}

export interface GovernorateShowProps {
    governorate: {
        id: string;
        name_ar: string;
        name_en: string;
        pcode: string;
        lat: number;
        lng: number;
        centre_ar: string;
        area_sqkm: number | null;
        icon_path: string | null;
        landmark_ar: string | null;
    };
    population: PopulationInfo | null;
    officials: GovernorateOfficialsData;
    prayer: GovernoratePrayerData | null;
    transit: GovernorateTransitData | null;
    crossings: GovernorateCrossingItem[];
    places: GovernoratePlacesData | null;
    phonebook: GovernoratePhonebookItem[];
    otherGovernorates: OtherGovernorateLink[];
    iconCredit: IconCredit;
}
