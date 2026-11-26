import { api as client, API_V1, type ApiRequestConfig } from '@/Lib/api';
import type {
    GovtCvEntryItem,
    GovtCvsStats,
    GovtEvidenceItem,
    GovtMovementItem,
    GovtOfficeSlotItem,
    GovtOfficialAdminSummary,
    GovtOfficialDetail,
} from './types';

/**
 * The Government CVs (`السير الذاتية للمسؤولين`) API client.
 * All public and admin `/api/v1/govtcvs...` and `/api/v1/admin/govtcvs...` calls
 * go through here so no page or component ever spells an API path directly.
 */

const PUBLIC = `${API_V1}/govtcvs`;
const ADMIN = `${API_V1}/admin/govtcvs`;

export const govtCvsApi = {
    // Public endpoints
    list(params?: Record<string, unknown>, options?: ApiRequestConfig): Promise<{
        officials: GovtOfficialAdminSummary[];
        stats: GovtCvsStats;
    }> {
        return client.get(PUBLIC, { ...options, params });
    },

    movements(params?: Record<string, unknown>, options?: ApiRequestConfig): Promise<{
        movements: GovtMovementItem[];
        stats?: GovtCvsStats;
    }> {
        return client.get(`${PUBLIC}/movements`, { ...options, params });
    },

    show(slug: string, options?: ApiRequestConfig): Promise<{
        official: GovtOfficialDetail;
    }> {
        return client.get(`${PUBLIC}/${encodeURIComponent(slug)}`, options);
    },

    // Admin Official CRUD
    createOfficial<T = { official: GovtOfficialDetail }>(input: unknown): Promise<T> {
        return client.post(`${ADMIN}/officials`, input);
    },

    updateOfficial<T = { official: GovtOfficialDetail }>(id: string, input: unknown): Promise<T> {
        return client.put(`${ADMIN}/officials/${encodeURIComponent(id)}`, input);
    },

    deleteOfficial(id: string): Promise<void> {
        return client.delete(`${ADMIN}/officials/${encodeURIComponent(id)}`);
    },

    publishOfficial<T = { official: GovtOfficialDetail }>(
        id: string,
        publishStatus: 'draft' | 'published' | 'archived',
    ): Promise<T> {
        if (publishStatus === 'archived') {
            return client.patch(`${ADMIN}/officials/${encodeURIComponent(id)}/archive`);
        }
        return client.patch(`${ADMIN}/officials/${encodeURIComponent(id)}/publish`, {
            publish_status: publishStatus,
        });
    },

    uploadPortrait(file: File, officialId?: string | null): Promise<{ url: string; portrait_url?: string }> {
        const form = new FormData();
        form.append('image', file);
        if (officialId) {
            form.append('official_id', officialId);
            return client.post(`${ADMIN}/officials/${encodeURIComponent(officialId)}/portrait`, form);
        }
        return Promise.reject(new Error('يرجى حفظ ملف المسؤول أولاً قبل رفع الصورة الشخصية.'));
    },

    // Admin Tenures CRUD
    createTenure<T = { official?: GovtOfficialDetail; tenure?: unknown }>(
        officialId: string,
        input: unknown,
    ): Promise<T> {
        return client.post(`${ADMIN}/officials/${encodeURIComponent(officialId)}/tenures`, input);
    },

    updateTenure<T = { official?: GovtOfficialDetail; tenure?: unknown }>(
        tenureId: string,
        input: unknown,
    ): Promise<T> {
        return client.put(`${ADMIN}/tenures/${encodeURIComponent(tenureId)}`, input);
    },

    deleteTenure<T = { official?: GovtOfficialDetail }>(tenureId: string): Promise<T> {
        return client.delete(`${ADMIN}/tenures/${encodeURIComponent(tenureId)}`);
    },

    // Admin CV Entries CRUD & Reorder
    createCvEntry<T = { official?: GovtOfficialDetail; cv_entry?: GovtCvEntryItem }>(
        officialId: string,
        input: unknown,
    ): Promise<T> {
        return client.post(`${ADMIN}/officials/${encodeURIComponent(officialId)}/cv-entries`, input);
    },

    updateCvEntry<T = { official?: GovtOfficialDetail; cv_entry?: GovtCvEntryItem }>(
        entryId: string,
        input: unknown,
    ): Promise<T> {
        return client.put(`${ADMIN}/cv-entries/${encodeURIComponent(entryId)}`, input);
    },

    deleteCvEntry<T = { official?: GovtOfficialDetail }>(entryId: string): Promise<T> {
        return client.delete(`${ADMIN}/cv-entries/${encodeURIComponent(entryId)}`);
    },

    reorderCvEntries<T = { official?: GovtOfficialDetail }>(
        officialId: string,
        ids: string[],
    ): Promise<T> {
        return client.post(`${ADMIN}/officials/${encodeURIComponent(officialId)}/cv-entries/reorder`, {
            ids,
            orders: ids.map((id, index) => ({ id, order_column: index + 1, sort_order: index + 1 })),
        });
    },

    reorderCvEntriesEndpoint(officialId: string): string {
        return `${ADMIN}/officials/${encodeURIComponent(officialId)}/cv-entries/reorder`;
    },

    // Admin Evidence Links CRUD
    createEvidence<T = { official?: GovtOfficialDetail; evidence?: GovtEvidenceItem }>(
        officialId: string,
        input: unknown,
    ): Promise<T> {
        return client.post(`${ADMIN}/officials/${encodeURIComponent(officialId)}/evidence`, input);
    },

    updateEvidence<T = { official?: GovtOfficialDetail; evidence?: GovtEvidenceItem }>(
        evidenceId: string,
        input: unknown,
    ): Promise<T> {
        return client.put(`${ADMIN}/evidence/${encodeURIComponent(evidenceId)}`, input);
    },

    deleteEvidence<T = { official?: GovtOfficialDetail }>(evidenceId: string): Promise<T> {
        return client.delete(`${ADMIN}/evidence/${encodeURIComponent(evidenceId)}`);
    },

    // Admin Office Slots CRUD
    saveSlot<T = { slot: GovtOfficeSlotItem }>(id: string | null, input: unknown): Promise<T> {
        return id
            ? client.put(`${ADMIN}/slots/${encodeURIComponent(id)}`, input)
            : client.post(`${ADMIN}/slots`, input);
    },

    deleteSlot(id: string): Promise<void> {
        return client.delete(`${ADMIN}/slots/${encodeURIComponent(id)}`);
    },
};
