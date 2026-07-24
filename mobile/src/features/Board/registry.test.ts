import { createDefaultDocument } from './model';
import { WIDGETS, findWidget } from './registry';

test('registers every source Board widget under its permanent id', () => {
  expect(WIDGETS.map((widget) => widget.id)).toEqual([
    'clock',
    'weather',
    'prayer',
    'places-nearby',
    'guides',
    'answers',
    'events-today',
    'rss',
    'transit-cities',
    'recipe',
    'notes',
    'todo',
    'pomodoro',
  ]);
  expect(new Set(WIDGETS.map((widget) => widget.id)).size).toBe(13);
  expect(findWidget('future-widget')).toBeUndefined();
});

test('seeds only registered widgets with definition defaults', () => {
  const document = createDefaultDocument();
  const widgets = document.dashboards[0]?.widgets ?? [];

  expect(widgets).toHaveLength(10);
  for (const instance of widgets) {
    const definition = findWidget(instance.d);
    expect(definition).toBeDefined();
    expect(instance.c).toEqual(
      Object.fromEntries(
        definition?.fields.map((field) => [field.key, field.default]) ?? [],
      ),
    );
  }
});
