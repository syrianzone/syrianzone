import { useQuery } from '@tanstack/react-query';

import {
  DirectoryScreen,
  getDirectoryQueryPresentation,
} from '@/components/directory';
import { directoryQueryKeys } from '@/lib/api/directories';

import { fetchGovApps } from './data';
import GovAppsClient from './GovAppsClient';

export default function GovAppsPage() {
  const query = useQuery({
    queryFn: ({ signal }) => fetchGovApps(signal),
    queryKey: directoryQueryKeys.governmentApps,
  });
  const apps = query.data;
  const state = getDirectoryQueryPresentation(query);
  const retry = () => {
    void query.refetch();
  };

  return (
    <DirectoryScreen
      cachedWarning={
        state.cached
          ? 'تعذر تحديث الدليل. يتم عرض آخر بيانات محفوظة.'
          : undefined
      }
      empty={apps?.length === 0}
      emptyDetail="ستظهر التطبيقات الحكومية هنا عند توفرها."
      emptyTitle="لم يتم العثور على تطبيقات"
      errorDetail={
        state.error
          ? 'تعذر تحميل دليل التطبيقات. تحقق من اتصالك وحاول مرة أخرى.'
          : undefined
      }
      isLoading={state.loading}
      loadingLabel="جاري تحميل التطبيقات الحكومية..."
      onRetry={retry}
      refreshing={state.refreshing}
      subtitle="دليل التطبيقات الحكومية الرسمية"
      title="تطبيقات حكومية"
    >
      {apps ? <GovAppsClient initialData={apps} /> : null}
    </DirectoryScreen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/GovApps/Index.tsx (21 lines)
  confidence: high
  todos:      0
  notes:      React Query now owns validated loading, cached, error, and retry states.
*/
