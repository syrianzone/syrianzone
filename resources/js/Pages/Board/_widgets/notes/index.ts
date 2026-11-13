import { StickyNote } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';

export interface NotesConfig {
  text: string;
}

export const notesWidget: WidgetDeclaration = {
  id: 'notes',
  name: 'ملاحظات',
  description: 'ملاحظات سريعة تبقى معك',
  icon: StickyNote,
  category: 'personal',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  // the note body is edited in place, not in the config dialog
  fields: [],
  requires: [],
  refresh: { staleMs: 0, intervalMs: null },
  multiple: true,
  seed: { order: 9, w: 6, h: 3 },
  source: null,
};

export default notesWidget;
