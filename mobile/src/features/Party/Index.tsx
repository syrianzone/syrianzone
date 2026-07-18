import { useQuery } from '@tanstack/react-query';

import {
  DirectoryScreen,
  getDirectoryQueryPresentation,
} from '@/components/directory';
import { directoryQueryKeys } from '@/lib/api/directories';

import { fetchOrganizations } from './data';
import PartyClient from './PartyClient';

export default function PartyPage() {
  const query = useQuery({
    queryFn: ({ signal }) => fetchOrganizations(signal),
    queryKey: directoryQueryKeys.parties,
  });
  const organizations = query.data;
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
          ? 'تعذر تحميل دليل المنظمات. تحقق من اتصالك وحاول مرة أخرى.'
          : undefined
      }
      isLoading={state.loading}
      loadingLabel="جاري تحميل دليل المنظمات..."
      onRetry={retry}
      refreshing={state.refreshing}
      subtitle="تصفح المنظمات والأحزاب والحركات السياسية السورية حول العالم"
      title="دليل المنظمات السياسية السورية"
    >
      {organizations ? (
        <PartyClient initialOrganizations={organizations} />
      ) : null}
    </DirectoryScreen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Party/Index.tsx (21 lines)
  confidence: high
  todos:      0
  notes:      React Query now owns validated loading, cached, error, and retry states.
*/
