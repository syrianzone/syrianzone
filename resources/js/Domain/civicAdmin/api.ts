import { api, API_V1 } from '@/Lib/api';

export type CrossingType = 'crossing' | 'port';
export type CrossingStatus = 'open' | 'closed' | 'opening_soon' | 'unknown';

export interface AdminCrossing {
    id: number;
    slug: string;
    name_ar: string;
    name_en: string | null;
    country: string | null;
    governorate: string | null;
    type: CrossingType;
    status: CrossingStatus;
    hours_ar: string | null;
    notes_ar: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    sort_order: number;
    is_active: boolean;
    meta?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface CrossingPayload {
    slug?: string | null;
    name_ar: string;
    name_en?: string | null;
    country?: string | null;
    governorate?: string | null;
    type?: CrossingType;
    status?: CrossingStatus;
    hours_ar?: string | null;
    notes_ar?: string | null;
    phone?: string | null;
    lat?: number | null;
    lng?: number | null;
    sort_order?: number;
    is_active?: boolean;
    meta?: Record<string, unknown> | null;
}

export interface AdminSyrianSite {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    url: string;
    category: string | null;
    tags: string[] | null;
    icon_url: string | null;
    is_active: boolean;
    sort_order: number;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface SyrianSitePayload {
    slug?: string | null;
    name: string;
    description?: string | null;
    url: string;
    category?: string | null;
    tags?: string[] | null;
    icon_url?: string | null;
    is_active?: boolean;
    sort_order?: number;
}

export type HouseMemberGender = 'M' | 'F';
export type HouseMemberStatus = 'active' | 'resigned' | 'dead' | 'inactive';

export interface AdminHouseMember {
    id: number;
    name_ar: string;
    governorate_ar: string | null;
    district: string | null;
    town: string | null;
    gender: HouseMemberGender | null;
    birth_year: number | null;
    age: number | null;
    selection_method: string | null;
    category: string | null;
    status: HouseMemberStatus;
    member_number: string | null;
    management_position: string | null;
    facebook_url: string | null;
    twitter_url: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface HouseMemberPayload {
    name_ar: string;
    governorate_ar?: string | null;
    district?: string | null;
    town?: string | null;
    gender?: HouseMemberGender | null;
    birth_year?: number | null;
    age?: number | null;
    selection_method?: string | null;
    category?: string | null;
    status?: HouseMemberStatus;
    member_number?: string | null;
    management_position?: string | null;
    facebook_url?: string | null;
    twitter_url?: string | null;
}

export const crossingsAdminApi = {
    create(payload: CrossingPayload): Promise<{ success: boolean; crossing: AdminCrossing }> {
        return api.post(`${API_V1}/admin/crossings`, payload);
    },

    update(id: number, payload: Partial<CrossingPayload>): Promise<{ success: boolean; crossing: AdminCrossing }> {
        return api.put(`${API_V1}/admin/crossings/${id}`, payload);
    },

    remove(id: number): Promise<{ success: boolean }> {
        return api.delete(`${API_V1}/admin/crossings/${id}`);
    },
};

export const sitesAdminApi = {
    create(payload: SyrianSitePayload): Promise<{ success: boolean; site: AdminSyrianSite }> {
        return api.post(`${API_V1}/admin/sites`, payload);
    },

    update(id: number, payload: Partial<SyrianSitePayload>): Promise<{ success: boolean; site: AdminSyrianSite }> {
        return api.put(`${API_V1}/admin/sites/${id}`, payload);
    },

    remove(id: number): Promise<{ success: boolean }> {
        return api.delete(`${API_V1}/admin/sites/${id}`);
    },
};

export const houseAdminApi = {
    create(payload: HouseMemberPayload): Promise<{ success: boolean; member: AdminHouseMember }> {
        return api.post(`${API_V1}/admin/house/members`, payload);
    },

    update(id: number, payload: Partial<HouseMemberPayload>): Promise<{ success: boolean; member: AdminHouseMember }> {
        return api.put(`${API_V1}/admin/house/members/${id}`, payload);
    },

    remove(id: number): Promise<{ success: boolean }> {
        return api.delete(`${API_V1}/admin/house/members/${id}`);
    },
};
