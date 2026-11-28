import { api, API_V1 } from '@/Lib/api';

const BASE = `${API_V1}/admin/users`;

export type UserRoleOption = 'superadmin' | 'user';

export interface AdminUserRecord {
    id: number;
    name: string;
    email: string;
    role: string;
    is_banned: boolean;
    avatar_url: string | null;
    permissions: string[];
    effective_permissions: string[];
    permission_scopes: Record<string, string[]> | null;
    transit_scope: string[];
    created_at: string | null;
    deleted_at: string | null;
}

export interface CreateUserPayload {
    name: string;
    email: string;
    password: string;
    role: UserRoleOption;
    is_banned: boolean;
    permissions: string[];
    transit_scope: string[];
}

export interface UpdateUserPayload {
    name: string;
    email: string;
    password?: string;
    role: UserRoleOption;
    is_banned: boolean;
    permissions: string[];
    transit_scope: string[];
}

export interface UserMutationResponse {
    ok: boolean;
    user: AdminUserRecord;
    message?: string;
}

export interface DeleteUserResponse {
    ok: boolean;
    message?: string;
}

export interface ToggleBanResponse {
    ok: boolean;
    is_banned: boolean;
    message?: string;
}

export const usersAdminApi = {
    create(payload: CreateUserPayload): Promise<UserMutationResponse> {
        return api.post<UserMutationResponse>(BASE, payload);
    },

    update(id: number, payload: UpdateUserPayload): Promise<UserMutationResponse> {
        return api.put<UserMutationResponse>(`${BASE}/${id}`, payload);
    },

    remove(id: number): Promise<DeleteUserResponse> {
        return api.delete<DeleteUserResponse>(`${BASE}/${id}`);
    },

    restore(id: number): Promise<UserMutationResponse> {
        return api.post<UserMutationResponse>(`${BASE}/${id}/restore`);
    },

    toggleBan(id: number): Promise<ToggleBanResponse> {
        return api.patch<ToggleBanResponse>(`${BASE}/${id}/ban`);
    },
};
