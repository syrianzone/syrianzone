export interface SocialLinks {
    [key: string]: string;
}

/**
 * An official Syrian entity. The public page receives a subset (its category as
 * an id string); the admin listing and its edit form carry `category_id`,
 * `is_active` and the row order, so both sides share this one declaration.
 */
export interface OfficialEntity {
    id: string;
    name: string;
    name_ar: string;
    description?: string | null;
    description_ar?: string | null;
    image?: string | null;
    /** The category id the entity belongs to. */
    category: string;
    socials?: SocialLinks | null;
    /** Admin listings only. */
    category_id?: string;
    is_active?: boolean;
    order_column?: number;
}

/** A category row: the public chips read the labels, the admin reads the flag. */
export interface OfficialCategory {
    id: string;
    label_ar: string;
    label_en: string;
    icon?: string | null;
    order_column?: number;
    is_active?: boolean;
}

/** An admin listing row: the entity with the columns the admin table shows. */
export interface AdminOfficialEntity extends OfficialEntity {
    category_id: string;
    is_active: boolean;
}
