import { api as client, API_V1 } from '@/Lib/api';
import type {
    DirectorySuggestionInput,
    DirectorySuggestionItem,
    DirectorySuggestionListResponse,
    SuggestionModule,
    SuggestionStatus,
} from './types';

export const suggestionsApi = {
    submit(
        module: SuggestionModule,
        input: DirectorySuggestionInput,
    ): Promise<{ id: number; message: string }> {
        return client.post(`${API_V1}/suggestions/${module}`, input);
    },

    list(
        module: SuggestionModule,
        status: SuggestionStatus | 'all' = 'pending',
    ): Promise<DirectorySuggestionListResponse> {
        return client.get(`${API_V1}/admin/${module}/suggestions?status=${encodeURIComponent(status)}`);
    },

    review(
        module: SuggestionModule,
        id: number,
        action: 'accept' | 'dismiss',
        resolutionNote?: string,
    ): Promise<{ suggestion: DirectorySuggestionItem; message: string }> {
        return client.post(`${API_V1}/admin/${module}/suggestions/${id}/${action}`, {
            resolution_note: resolutionNote?.trim() || null,
        });
    },
};
