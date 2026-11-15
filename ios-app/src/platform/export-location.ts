import { exportFilename } from './document-model';

export function namedExportLocation(filename: string, id: string): { directory: string; filename: string } {
  if (!exportFilename(filename) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))
    throw new Error('اسم الملف غير صالح.');
  return { directory: `sz-export-${id}`, filename };
}
