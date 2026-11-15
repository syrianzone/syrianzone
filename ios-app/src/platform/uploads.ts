import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { nativeUploadPart } from './native-upload-part';
import { imageUploadPart, type ImageUploadAsset, type ImageUploadBounds } from './upload-model';
export type { ImageUploadAsset, ImageUploadBounds } from './upload-model';

export async function pickImage(bounds: ImageUploadBounds, options: { allowsEditing?: boolean; aspect?: [number, number] } = {}): Promise<ImageUploadAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.9,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    allowsEditing: options.allowsEditing ?? false, ...(options.aspect ? { aspect: options.aspect } : {}) });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('لم يتم اختيار صورة.');
  let fileSize: number;
  try { fileSize = new File(asset.uri).size; } catch { throw new Error('تعذر قراءة الصورة المختارة.'); }
  const part = imageUploadPart({ ...asset, fileSize }, bounds);
  return { ...asset, fileSize, fileName: part.name, mimeType: part.type };
}

export function imageFormData(field: string, asset: ImageUploadAsset, bounds: ImageUploadBounds): FormData {
  const form = new FormData();
  appendImage(form, field, asset, bounds);
  return form;
}

export function appendImage(form: FormData, field: string, asset: ImageUploadAsset, bounds: ImageUploadBounds): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}(?:\[\])?$/.test(field)) throw new Error('حقل الصورة غير صالح.');
  let file: File, size: number;
  try { file = new File(asset.uri); size = file.size; } catch { throw new Error('تعذر قراءة الصورة المختارة.'); }
  const part = imageUploadPart({ ...asset, fileSize: size }, bounds);
  form.append(field, nativeUploadPart(file, part, size));
}
