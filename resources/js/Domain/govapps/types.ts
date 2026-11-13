interface GovAppLinks {
    official?: string | null;
    android?: string | null;
    apple?: string | null;
}

/**
 * A government app. The public presenter sends the Arabic name and description
 * as `name`/`description`; the admin listing also carries the two language
 * columns, its row order and its visibility flag.
 */
export interface GovApp {
    id: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    images?: string[];
    links?: GovAppLinks | null;
    /** Admin listings and the edit form only. */
    name_ar?: string | null;
    description_ar?: string | null;
    order_column?: number;
    is_active?: boolean;
}
