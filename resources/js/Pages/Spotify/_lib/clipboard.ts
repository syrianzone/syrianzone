import { toast } from '@/Components/ui/sonner';

export async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error('تعذر النسخ، انسخ الرابط يدوياً');
  }
}
