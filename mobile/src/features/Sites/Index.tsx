import { useQuery } from '@tanstack/react-query';

import {
  DirectoryScreen,
  getDirectoryQueryPresentation,
} from '@/components/directory';
import { directoryQueryKeys } from '@/lib/api/directories';

import { fetchWebsites } from './data';
import SitesClient from './SitesClient';

export default function SitesPage() {
  const query = useQuery({
    queryFn: ({ signal }) => fetchWebsites(signal),
    queryKey: directoryQueryKeys.sites,
  });
  const websites = query.data;
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
      errorDetail={
        state.error
          ? 'تعذر تحميل دليل المواقع. تحقق من اتصالك وحاول مرة أخرى.'
          : undefined
      }
      isLoading={state.loading}
      loadingLabel="جاري تحميل المواقع السورية..."
      onRetry={retry}
      refreshing={state.refreshing}
      subtitle="قاعدة بيانات المواقع السورية مصنفة حسب القطاعات"
      title="المواقع السورية"
    >
      {websites ? <SitesClient initialWebsites={websites} /> : null}
    </DirectoryScreen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Sites/Index.tsx (21 lines)
  confidence: high
  todos:      0
  notes:      React Query now owns validated loading, cached, error, and retry states.
*/
