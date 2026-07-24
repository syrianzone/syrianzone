import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const MAX_BYTES = 12 * 1024 * 1024;
// mirrors the server's dimensions rule so users get an Arabic message before uploading
export const MIN_DIM = 200;
export const MAX_DIM = 6000;

export async function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    // unreadable here, let the server validate
    return null;
  }
}

export function PhotoPicker(props: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  const { files, onChange, max = 10 } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const handlePick = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const errors: string[] = [];
    const accepted = [...files];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_BYTES) {
        errors.push(`الصورة ${file.name} تتجاوز 12 ميغابايت`);
        continue;
      }
      const dims = await imageDimensions(file);
      if (dims && (dims.width < MIN_DIM || dims.height < MIN_DIM)) {
        errors.push(`الصورة ${file.name} أصغر من ${MIN_DIM}x${MIN_DIM} بكسل`);
        continue;
      }
      if (dims && (dims.width > MAX_DIM || dims.height > MAX_DIM)) {
        errors.push(`الصورة ${file.name} تتجاوز ${MAX_DIM}x${MAX_DIM} بكسل`);
        continue;
      }
      if (accepted.length >= max) {
        errors.push(`الحد الأقصى ${max} صور`);
        break;
      }
      accepted.push(file);
    }
    setError(errors.length ? errors.join('، ') : null);
    if (accepted.length !== files.length) onChange(accepted);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    setError(null);
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-3 gap-2">
        {files.map((file, i) => (
          <div key={previews[i]} className="relative rounded-md border border-border overflow-hidden">
            <img src={previews[i]} alt={file.name} className="h-24 w-full object-cover" />
            <button
              type="button"
              aria-label="إزالة الصورة"
              onClick={() => removeAt(i)}
              className="absolute top-1 left-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
            <span dir="ltr" className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-0.5">
              {(file.size / 1048576).toFixed(1)} MB
            </span>
          </div>
        ))}
        {files.length < max && (
          <Button
            type="button"
            variant="outline"
            className="h-24 flex-col gap-1 text-muted-foreground"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs">إضافة صور</span>
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        من 1 إلى {max} صور، بحد أقصى 12 ميغابايت لكل صورة
      </p>
    </div>
  );
}
