import { lazy } from 'react';
import { ListTodo } from 'lucide-react';
import type { WidgetDefinition } from '../../_lib/types';

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoConfig {
  items: TodoItem[];
  hideCompleted: boolean;
}

export const todoWidget: WidgetDefinition<TodoConfig> = {
  id: 'todo',
  name: 'مهامي',
  description: 'قائمة مهام قصيرة تبقى معك',
  icon: ListTodo,
  category: 'personal',
  // The list needs the add box plus a few visible rows: at 76px per row unit
  // minus the ~37px shell header, h:4 leaves room for the input and ~6 items.
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 8 },
  // The items are edited in place. Only the display preference is a real
  // setting, so it is the one thing the config dialog owns.
  fields: [
    { key: 'hideCompleted', type: 'switch', label: 'إخفاء المنجزة', default: false },
  ],
  requires: [],
  refresh: { staleMs: 0, intervalMs: null },
  multiple: true,
  Component: lazy(() => import('./View')),
};
