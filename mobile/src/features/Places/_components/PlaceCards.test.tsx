import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import type { NearbyPlace, PlaceListItem } from '../_lib/types';
import { DuplicateSuggestions } from './DuplicateSuggestions';
import { PlaceCard } from './PlaceCard';

function wrap(children: React.ReactNode) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

const foodPlace: PlaceListItem = {
  category: 'food',
  description: 'مطبخ شعبي يقدم أطباقاً سورية محلية.',
  id: 31,
  lat: 33.5,
  lng: 36.3,
  name: 'مطبخ دمشقي',
  saves_count: 4,
  thumb_url: null,
};

test('renders the current food category card', async () => {
  const view = await render(wrap(<PlaceCard onPress={jest.fn()} place={foodPlace} />));

  expect(view.getByText('مأكولات')).toBeTruthy();
  expect(view.getByText(foodPlace.name)).toBeTruthy();
});

test('reassures contributors that nearby places do not block submission', async () => {
  const onContinue = jest.fn();
  const nearby: NearbyPlace = { ...foodPlace, distance_m: 80 };
  const view = await render(wrap(
    <DuplicateSuggestions onContinue={onContinue} onSelectExisting={jest.fn()} places={[nearby]} />,
  ));

  expect(view.getByText('إن كان مكانك مختلفاً يمكنك إضافته بلا مشكلة')).toBeTruthy();
  await fireEvent.press(view.getByText('متابعة الإضافة على أي حال'));
  expect(onContinue).toHaveBeenCalledTimes(1);
});
