import { useEffect, useRef, useState, type RefObject } from 'react';
import type Svg from 'react-native-svg';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createSvgImageFile } from '../src/platform/files';
import { imagePixelSize } from './image-header';

interface OwnedProbe { id: string; directory: Directory; file: File | null }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function cachePath(uri: string): string {
  const value = new URL(uri), cache = new URL(Paths.cache.uri);
  if (value.protocol !== 'file:' || value.hostname || value.search || value.hash || !value.pathname.startsWith(cache.pathname.replace(/\/$/, '') + '/')) throw new Error('The generated cache copy escaped its task boundary.');
  return value.pathname.slice(cache.pathname.replace(/\/$/, '').length + 1);
}
function cleanup(current: OwnedProbe): { fileExists: boolean; directoryExists: boolean } {
  if (!uuid.test(current.id) || cachePath(current.directory.uri).replace(/\/$/, '') !== `sz-save-controller-${current.id}`) throw new Error('Only this mount-owned cache directory may be removed.');
  if (current.file) {
    const relative = cachePath(current.file.uri), expected = `sz-save-controller-${current.id}/native-files-${current.id}.png`;
    if (relative !== expected && !/^sz-render-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.png$/i.test(relative)) throw new Error('Only the captured generated SVG copy may be removed.');
    if (current.file.exists) current.file.delete();
    if (current.file.exists) throw new Error('The exact generated file remains after cleanup.');
  }
  if (current.directory.exists) {
    if (current.directory.list().length !== 0) throw new Error('Unexpected cache entries are retained without recursive deletion.');
    current.directory.delete();
  }
  return { fileExists: current.file?.exists ?? false, directoryExists: current.directory.exists };
}

// Adapter only. Real SVG encoder and native share UI, no user Files writes.
export function useSaveControllerProbe(svg: RefObject<Svg | null>, id: string): { status: string; ready: boolean; prepare(): Promise<void>; open(): Promise<void> } {
  const [state, setState] = useState<Record<string, string | number | boolean>>({ phase: 'idle', id });
  const owned = useRef<OwnedProbe | null>(null), alive = useRef(true), running = useRef(false), started = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (owned.current) { cleanup(owned.current); owned.current = null; } };
  }, []);
  function remove(current: OwnedProbe, metadata: Record<string, string | number | boolean>, phase: string): void {
    try {
      const result = cleanup(current);
      if (alive.current) setState({ ...metadata, ...result, phase });
      if (owned.current === current) owned.current = null;
    } catch (error) {
      if (alive.current) setState({ ...metadata, phase: 'cleanup-error', fileExists: current.file?.exists ?? false, directoryExists: current.directory.exists });
      throw error;
    }
  }
  async function prepare(): Promise<void> {
    if (running.current || started.current || state.phase !== 'idle') throw new Error('The save-controller probe is one-use for this mount.');
    if (!uuid.test(id) || !svg.current) throw new Error('A fresh mount UUID and actual SVG view are required.');
    running.current = true; started.current = true;
    const filename = `native-files-${id}.png`, directory = new Directory(Paths.cache, `sz-save-controller-${id}`);
    const metadata = { id, filename, phase: 'preparing' };
    if (directory.exists) { running.current = false; throw new Error('A preexisting task cache directory refuses overwrite.'); }
    directory.create();
    const current: OwnedProbe = { id, directory, file: null };
    owned.current = current;
    if (alive.current) setState(metadata);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Native sharing is unavailable.');
      const rendered = await createSvgImageFile(svg.current, { width: 80, height: 40, format: 'png' });
      current.file = rendered.file;
      if (!alive.current) { remove(current, metadata, 'failed-clean'); return; }
      const generatedURI = rendered.file.uri, generatedSize = rendered.file.size;
      if (!rendered.file.exists || !Number.isSafeInteger(generatedSize) || generatedSize < 1 || generatedSize > 1_000_000
        || rendered.mimeType !== 'image/png') throw new Error('The actual generated PNG must be bounded before reading its bytes.');
      const bytes = await rendered.file.bytes();
      if (!alive.current || owned.current !== current || current.file !== rendered.file || rendered.file.uri !== generatedURI
        || !rendered.file.exists || rendered.file.size !== generatedSize || bytes.length !== generatedSize) throw new Error('The exact generated PNG changed while reading its bytes.');
      const dimensions = imagePixelSize(bytes, 'png');
      if (dimensions.width !== 80 || dimensions.height !== 40) throw new Error('The actual generated PNG must be 80x40.');
      const target = new File(directory, filename);
      if (target.exists) throw new Error('The exact generated target must be absent before staging.');
      await rendered.file.move(target);
      if (alive.current) setState({ id, filename, phase: 'ready', width: dimensions.width, height: dimensions.height,
        mimeType: rendered.mimeType, bytes: rendered.file.size, fileExists: rendered.file.exists, directoryExists: directory.exists });
    } catch (error) { remove(current, metadata, 'failed-clean'); throw error; }
    finally { running.current = false; }
  }
  async function open(): Promise<void> {
    const current = owned.current;
    if (running.current || state.phase !== 'ready' || !current?.file || current.id !== id) throw new Error('Only this mount-owned prepared PNG may open the share panel.');
    const relative = cachePath(current.file.uri);
    if (relative !== `sz-save-controller-${id}/native-files-${id}.png` || !current.file.exists || current.file.size !== state.bytes
      || current.directory.list().length !== 1) throw new Error('The exact captured generated PNG must remain unchanged before sharing.');
    running.current = true;
    const metadata = { ...state, phase: 'presenting' };
    if (alive.current) setState(metadata);
    let returned = false;
    try {
      await Sharing.shareAsync(current.file.uri, { mimeType: 'image/png', dialogTitle: `native-files-${id}.png` });
      returned = true;
    } finally {
      try { remove(current, metadata, returned ? 'returned-clean' : 'failed-clean'); }
      finally { running.current = false; }
    }
  }
  return { status: JSON.stringify(state), ready: state.phase === 'ready', prepare, open };
}
