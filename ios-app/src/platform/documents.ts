import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { nativeUploadPart } from './native-upload-part';
import { documentPart, type SelectedDocument } from './document-model';
export type { SelectedDocument } from './document-model';
export async function pickDocument(): Promise<SelectedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('لم يتم اختيار ملف.');
  const selected = {
    uri: asset.uri,
    name: asset.name,
    size: new File(asset.uri).size,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
  };
  documentPart(selected);
  return selected;
}
export function documentFormData(field: string, asset: SelectedDocument): FormData {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field)) throw new Error('حقل الملف غير صالح.');
  const file = new File(asset.uri),
    size = file.size,
    part = documentPart({ ...asset, size }),
    form = new FormData();
  form.append(field, nativeUploadPart(file, part, size));
  return form;
}
