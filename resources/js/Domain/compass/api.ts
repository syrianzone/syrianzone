import { api as client, API_V1 } from '@/Lib/api';

/**
 * The compass admin's two catalogues: alignment figures and personas. Each row
 * is created, edited, toggled and deleted by these routes only.
 */

const FIGURES = `${API_V1}/admin/compass/figures`;
const PERSONAS = `${API_V1}/admin/compass/personas`;

export const compassAdminApi = {
  uploadFigureImage(file: File): Promise<{ url: string; path: string }> {
    const form = new FormData();
    form.append('image', file);
    return client.post(`${FIGURES}/upload-image`, form);
  },

  saveFigure(id: number | string | null, payload: unknown): Promise<unknown> {
    return id ? client.put(`${FIGURES}/${id}`, payload) : client.post(FIGURES, payload);
  },

  toggleFigure(id: number | string): Promise<unknown> {
    return client.post(`${FIGURES}/${id}/toggle`);
  },

  removeFigure(id: number | string): Promise<void> {
    return client.delete(`${FIGURES}/${id}`);
  },

  savePersona(id: number | string | null, payload: unknown): Promise<unknown> {
    return id ? client.put(`${PERSONAS}/${id}`, payload) : client.post(PERSONAS, payload);
  },

  togglePersona(id: number | string): Promise<unknown> {
    return client.post(`${PERSONAS}/${id}/toggle`);
  },

  removePersona(id: number | string): Promise<void> {
    return client.delete(`${PERSONAS}/${id}`);
  },
};
