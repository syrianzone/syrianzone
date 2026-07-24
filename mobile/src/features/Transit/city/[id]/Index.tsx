import { router, useLocalSearchParams } from 'expo-router';
import { Map } from 'lucide-react-native';

import { AppButton } from '@/components/ui/AppButton';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';

import cities from '../../_data/cities';
import { useRoutes } from '../../_hooks/useMapData';
import { RoutesList } from './_components/RoutesList';
import CityLoading from './loading';

export default function TransitCityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = cities.find((item) => item.id === id);
  const routes = useRoutes(id);
  const { theme } = useAppTheme();
  if (routes.isPending) {
    return <CityLoading />;
  }
  return (
    <Screen
      subtitle={city?.nameEn ?? id}
      title={city?.nameAr ?? 'خطوط المدينة'}
      trailing={
        <AppButton
          icon={<Map color={theme.palette.primaryForeground} size={18} />}
          onPress={() =>
            router.push({
              pathname: '/transit/city/[id]/map',
              params: { id },
            })
          }
        >
          عرض الكل على الخريطة
        </AppButton>
      }
      onRefresh={() => void routes.refetch()}
      refreshing={routes.isRefetching}
    >
      {routes.isError ? (
        <QueryState onRetry={() => void routes.refetch()} type="error" />
      ) : routes.data ? (
        routes.data.length ? (
          <RoutesList cityId={id} routes={routes.data} />
        ) : (
          <QueryState detail="لا توجد خطوط منشورة لهذه المدينة بعد." type="empty" />
        )
      ) : null}
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/Index.tsx (85 lines)
  confidence: high
  todos:      0
  notes:      Route parameters, pending state, and refresh behavior use Expo Router and React Query.
*/
