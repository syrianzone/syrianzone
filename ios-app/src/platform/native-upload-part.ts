import type { File } from 'expo-file-system';

export function nativeUploadPart(file: File, metadata: { name: string; type: string }, size: number): Blob {
  // Expo fetch accepts File's async bytes interface and reads name/type for multipart headers.
  return { name: metadata.name, type: metadata.type, bytes: async () => {
    if (file.size !== size) throw new Error('تغير الملف المختار. اختره مرة أخرى.');
    const bytes = await file.bytes();
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== size || file.size !== size)
      throw new Error('تغير الملف المختار. اختره مرة أخرى.');
    return bytes;
  } } as unknown as Blob;
}
