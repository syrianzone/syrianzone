import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import type { GeoSuggestion, PlaceListItem } from '../_lib/types';
import { FilterBar } from './FilterBar';

const localPlace: PlaceListItem = {
  category: 'historical',
  description: 'سوق تاريخي في دمشق',
  id: 4,
  lat: 33.5112,
  lng: 36.3037,
  name: 'سوق الحميدية',
  saves_count: 12,
  thumb_url: null,
};

const suggestion: GeoSuggestion = {
  address: 'دمشق، سوريا',
  lat: 33.513,
  lng: 36.306,
  name: 'مدخل سوق الحميدية',
};

async function renderFilter(
  overrides: Partial<React.ComponentProps<typeof FilterBar>> = {},
) {
  const props: React.ComponentProps<typeof FilterBar> = {
    category: null,
    coordCandidate: null,
    geoResults: [suggestion],
    onCategoryChange: jest.fn(),
    onGoToCoord: jest.fn(),
    onQueryChange: jest.fn(),
    onSelectGeo: jest.fn(),
    onSelectResult: jest.fn(),
    query: 'الحميدية',
    results: [localPlace],
    resultsLoading: false,
    ...overrides,
  };
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <FilterBar {...props} />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  return { props, view };
}

test('shows local and Google suggestions with attribution', async () => {
  const { view } = await renderFilter();

  await fireEvent(view.getByLabelText('البحث عن مكان أو إحداثيات'), 'focus');

  expect(view.getByText(localPlace.name)).toBeTruthy();
  expect(view.getByText(suggestion.name)).toBeTruthy();
  expect(view.getByText(suggestion.address)).toBeTruthy();
  expect(view.getByText('powered by Google')).toBeTruthy();
});

test('selects a Google suggestion and closes the result list', async () => {
  const { props, view } = await renderFilter();

  await fireEvent(view.getByLabelText('البحث عن مكان أو إحداثيات'), 'focus');
  await fireEvent.press(view.getByText(suggestion.name));

  expect(props.onSelectGeo).toHaveBeenCalledWith(suggestion);
  expect(props.onSelectResult).not.toHaveBeenCalled();
  expect(view.queryByText('powered by Google')).toBeNull();
});

test('keeps coordinate jumps separate from Google results', async () => {
  const point = { lat: 34.73941, lng: 36.67507 };
  const { props, view } = await renderFilter({ coordCandidate: point });

  await fireEvent(view.getByLabelText('البحث عن مكان أو إحداثيات'), 'focus');

  expect(view.queryByText(suggestion.name)).toBeNull();
  await fireEvent.press(view.getByText('الانتقال إلى النقطة'));
  expect(props.onGoToCoord).toHaveBeenCalledWith(point);
});

test('submits the first Google result when no local result exists', async () => {
  const { props, view } = await renderFilter({ results: [] });

  await fireEvent(view.getByLabelText('البحث عن مكان أو إحداثيات'), 'focus');
  await fireEvent(view.getByLabelText('البحث عن مكان أو إحداثيات'), 'submitEditing');

  expect(props.onSelectGeo).toHaveBeenCalledWith(suggestion);
});
