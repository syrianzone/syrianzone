export interface GovAppLinks {
    official?: string | null;
    android?: string | null;
    apple?: string | null;
}

export interface GovAppFaq {
    q: string;
    a: string;
}

export interface GovAppPublisher {
    id: string;
    name_ar: string;
    name: string;
    image?: string | null;
    category_id?: string | null;
}

export interface GovAppStoreIdentifiers {
    android_package: string | null;
    is_direct_apk: boolean;
    apple_id: string | null;
    official_host: string | null;
}

/**
 * A government app. The public presenter sends the Arabic name and description
 * as `name`/`description`; the admin listing also carries the two language
 * columns, its row order and its visibility flag.
 */
export interface GovApp {
    id: string;
    name: string;
    name_en?: string | null;
    description?: string | null;
    icon?: string | null;
    images?: string[];
    links?: GovAppLinks | null;
    publisher_name?: string | null;
    has_rich_guide?: boolean;
    /** Admin listings and the edit form only. */
    name_ar?: string | null;
    description_ar?: string | null;
    order_column?: number;
    is_active?: boolean;
}

export interface GovAppDetail extends GovApp {
    overview_ar?: string | null;
    features: string[];
    requirements: string[];
    faqs: GovAppFaq[];
    verified_at?: string | null;
    updated_at?: string | null;
    publisher?: GovAppPublisher | null;
    store_identifiers: GovAppStoreIdentifiers;
}
