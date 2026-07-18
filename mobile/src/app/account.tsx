import { router } from 'expo-router';

import { AuthScreen } from '@/features/Auth/AuthScreen';

export default function AccountRoute() {
  return (
    <AuthScreen
      onOpenDashboard={() =>
        router.push({ pathname: '/feature/[slug]', params: { slug: 'dashboard' } })
      }
      onOpenPolls={() =>
        router.push({ pathname: '/feature/[slug]', params: { slug: 'polls' } })
      }
      onOpenProfile={() =>
        router.push({
          pathname: '/feature/[slug]',
          params: { slug: 'dashboard', tab: 'profile' },
        })
      }
    />
  );
}
