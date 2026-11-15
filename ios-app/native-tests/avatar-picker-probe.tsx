import { useEffect, useRef, useState } from 'react';
import { Button, Image, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { avatarBounds } from '../src/features/Account/model';
import { pickImage, type ImageUploadAsset } from '../src/platform/uploads';
import { avatarProbeCacheUri } from './avatar-picker-probe-model';
import { imagePixelSize } from './image-header';

function removeOwnedCopy(file: File): void {
  if (avatarProbeCacheUri(file.uri, Paths.cache.uri) !== file.uri) throw new Error('The captured picker copy identity changed.');
  if (file.exists) file.delete();
  if (file.exists) throw new Error('The exact returned picker copy was not removed.');
}

// Adapter entry only. No account provider, API, upload, or persistent app state.
export function AvatarPickerProbe(): React.JSX.Element {
  const owned = useRef<File | null>(null), alive = useRef(true), opening = useRef(false);
  const [asset, setAsset] = useState<ImageUploadAsset | null>(null);
  const [status, setStatus] = useState<Record<string, string | number | boolean>>({ phase: 'ready' });
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (owned.current) { removeOwnedCopy(owned.current); owned.current = null; } };
  }, []);
  async function choose(): Promise<void> {
    if (opening.current || status.phase !== 'ready') return;
    opening.current = true; setStatus({ phase: 'opening' });
    let returned: Record<string, string | number | boolean> = {};
    try {
      const chosen = await pickImage(avatarBounds, { allowsEditing: true, aspect: [1, 1] });
      if (!chosen) { if (alive.current) setStatus({ phase: 'cancelled' }); return; }
      const file = new File(avatarProbeCacheUri(chosen.uri, Paths.cache.uri));
      owned.current = file;
      if (!alive.current) { removeOwnedCopy(file); owned.current = null; return; }
      if (!file.exists) throw new Error('The returned crop copy is missing.');
      const fileSize = file.size;
      returned = { width: chosen.width ?? 0, height: chosen.height ?? 0,
        mimeType: chosen.mimeType ?? '', bytes: fileSize, copiedFileExists: true };
      if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > avatarBounds.maxBytes) throw new Error('The exact returned fixture copy exceeds the avatar byte bound.');
      const bytes = await file.bytes();
      if (!alive.current) return;
      if (owned.current !== file || !file.exists || file.size !== fileSize || bytes.length !== fileSize) throw new Error('The captured fixture copy changed during its header read.');
      const format = chosen.mimeType === 'image/png' ? 'png' : chosen.mimeType === 'image/jpeg' ? 'jpg' : null;
      if (!format) throw new Error('The generated fixture must expose an independently readable PNG or JPEG header.');
      const encoded = imagePixelSize(bytes, format);
      setAsset(chosen);
      setStatus({ ...returned, phase: 'selected', encodedWidth: encoded.width, encodedHeight: encoded.height,
        encodedBytes: bytes.length, encodedMimeType: format === 'png' ? 'image/png' : 'image/jpeg' });
    } catch {
      if (alive.current) setStatus({ ...returned, phase: 'error', copiedFileExists: owned.current?.exists === true });
    } finally { opening.current = false; }
  }
  function clear(): void {
    if (!owned.current) return;
    removeOwnedCopy(owned.current); owned.current = null;
    setAsset(null); setStatus({ phase: 'removed', copiedFileExists: false });
  }
  const snapshot = JSON.stringify(status);
  return <View style={{ gap: 12 }}>
    <Text style={{ color: '#111111' }}>Generated fixture image only. Real avatar picker and crop, no account or upload.</Text>
    <Button testID="adapter.avatar.open" title="Open native avatar picker" disabled={status.phase !== 'ready'} onPress={() => { void choose(); }} />
    <Button testID="adapter.avatar.clear" title="Remove returned fixture copy" disabled={!owned.current} onPress={clear} />
    {asset ? <Image source={{ uri: asset.uri }} accessibilityLabel="Generated fixture crop result" style={{ width: 180, height: 180 }} /> : null}
    <Text testID="adapter.avatar.status" accessibilityLabel={snapshot} style={{ color: '#111111' }}>{snapshot}</Text>
  </View>;
}
