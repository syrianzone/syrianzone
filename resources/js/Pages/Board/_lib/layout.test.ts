import { describe, expect, it } from 'vitest';
import { activeDashboard, addDashboard, addWidget, selectDashboard, updateWidgetConfig } from './layout';
import { defaultDoc, findWidget } from './registry';

function notesWidget() {
  const def = findWidget('notes');
  if (!def) throw new Error('notes widget missing');
  return def;
}

describe('updateWidgetConfig', () => {
  it('patches a widget on a dashboard that is no longer active', () => {
    // a note on dashboard A flushes its last edit after the visitor switched to B
    let doc = addWidget(defaultDoc(), notesWidget());
    const first = activeDashboard(doc);
    const note = first.widgets[first.widgets.length - 1];
    doc = addDashboard(doc, 'B');
    expect(activeDashboard(doc).id).not.toBe(first.id);

    const next = updateWidgetConfig(doc, note.i, { text: 'آخر سطر' });
    const saved = next.dashboards.find((d) => d.id === first.id)?.widgets.find((w) => w.i === note.i);
    expect(saved?.c.text).toBe('آخر سطر');
    expect(next.activeId).toBe(doc.activeId);
  });

  it('returns the same document for an unknown widget', () => {
    const doc = selectDashboard(defaultDoc(), defaultDoc().activeId);
    expect(updateWidgetConfig(doc, 'w_missing', { text: 'x' })).toBe(doc);
  });
});
