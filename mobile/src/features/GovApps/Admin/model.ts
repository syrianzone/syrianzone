import type { AdminGovernmentApp } from '@/lib/api/directories/admin';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ar');
}

// The website admin list offers a name search only; government apps carry no
// category, so there is nothing else to filter by.
export function filterGovernmentApps(
  apps: readonly AdminGovernmentApp[],
  search: string,
): AdminGovernmentApp[] {
  const term = normalize(search);
  if (!term) {
    return [...apps];
  }

  return apps.filter((app) =>
    [app.name_ar, app.name, app.id].some((value) =>
      normalize(value).includes(term),
    ),
  );
}
