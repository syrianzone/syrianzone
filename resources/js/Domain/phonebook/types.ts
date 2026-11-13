export interface PhonebookCategory {
    id: string;
    label_ar: string;
    label_en: string;
    icon?: string | null;
    order_column?: number;
    is_active?: boolean;
}

/**
 * A phonebook row. The public page receives the category flattened
 * (`category_ar`/`category_en`); the admin listing carries `category_id` and
 * the nested category it edits by.
 */
export interface PhonebookEntry {
    id: string;
    category_id?: string;
    category_ar?: string;
    category_en?: string;
    name_ar: string;
    name_en?: string | null;
    number: string;
    is_whatsapp: boolean;
    source_url?: string | null;
    /** Admin listings only. */
    order_column?: number;
    is_active?: boolean;
    category?: PhonebookCategory | null;
}
