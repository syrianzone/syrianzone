import { useQueryClient } from '@tanstack/react-query';
import { Download, Globe2, Images, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  DirectoryCard,
  DirectoryDetailModal,
  DirectoryImage,
  DirectoryLinkAction,
} from '@/components/directory';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { directoryQueryKeys } from '@/lib/api/directories';

import {
  fetchStoreIcon,
  getGovAppIconUrl,
  getGovAppScreenshotUrl,
  STORE_ICON_CACHE_MS,
} from './data';
import type { GovApp } from './types';

interface GovAppsClientProps {
  initialData: readonly GovApp[];
}

export default function GovAppsClient({ initialData }: GovAppsClientProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<GovApp | null>(null);
  const [storeIcons, setStoreIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadIcons = async () => {
      const resolved: Record<string, string> = {};
      for (const app of initialData) {
        if (cancelled) {
          return;
        }
        let icon: null | string = null;
        try {
          icon = await queryClient.fetchQuery({
            gcTime: STORE_ICON_CACHE_MS,
            queryFn: ({ signal }) => fetchStoreIcon(app, signal),
            queryKey: [
              ...directoryQueryKeys.governmentApps,
              'icon',
              app.id,
            ],
            retry: 1,
            staleTime: (query) =>
              query.state.data ? STORE_ICON_CACHE_MS : 0,
          });
        } catch {
          icon = null;
        }
        if (icon) {
          resolved[app.id] = icon;
        }
      }
      if (!cancelled) {
        setStoreIcons(resolved);
      }
    };

    void loadIcons();
    return () => {
      cancelled = true;
    };
  }, [initialData, queryClient]);

  return (
    <View style={styles.screen}>
      <View style={styles.grid}>
        {initialData.map((app) => (
          <GovAppCard
            app={app}
            key={app.id}
            onSelect={setSelected}
            storeIcon={storeIcons[app.id] ?? null}
          />
        ))}
      </View>

      <DirectoryDetailModal
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'تفاصيل التطبيق'}
        visible={Boolean(selected)}
      >
        {selected ? (
          <GovAppDetail
            app={selected}
            storeIcon={storeIcons[selected.id] ?? null}
          />
        ) : null}
      </DirectoryDetailModal>
    </View>
  );
}

function GovAppCard({
  app,
  onSelect,
  storeIcon,
}: {
  app: GovApp;
  onSelect: (selected: GovApp) => void;
  storeIcon: null | string;
}) {
  const { theme } = useAppTheme();
  const iconUrl = getGovAppIconUrl(app, storeIcon);

  return (
    <View style={styles.gridItem}>
      <DirectoryCard
        accessibilityLabel={`عرض تفاصيل ${app.name}`}
        actions={
          <>
            <DirectoryLinkAction
              icon={<Download color={theme.palette.foreground} size={15} />}
              label="أندرويد"
              url={app.links.android}
            />
            <DirectoryLinkAction
              icon={<Download color={theme.palette.foreground} size={15} />}
              label="آيفون"
              url={app.links.apple}
            />
            <DirectoryLinkAction
              icon={<Globe2 color={theme.palette.foreground} size={15} />}
              label="الموقع"
              url={app.links.official}
            />
          </>
        }
        media={
          <DirectoryImage
            accessibilityLabel={`أيقونة ${app.name}`}
            fallbackUri={
              storeIcon ? getGovAppIconUrl(app, null) : undefined
            }
            style={styles.appIcon}
            uri={iconUrl}
          />
        }
        onPress={() => onSelect(app)}
        title={app.name}
      >
        <AppText color="muted" variant="caption">
          اضغط لعرض التفاصيل
        </AppText>
      </DirectoryCard>
    </View>
  );
}

function GovAppDetail({
  app,
  storeIcon,
}: {
  app: GovApp;
  storeIcon: null | string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.detail}>
      <View style={styles.detailHeader}>
        <DirectoryImage
          accessibilityLabel={`أيقونة ${app.name}`}
          fallbackUri={storeIcon ? getGovAppIconUrl(app, null) : undefined}
          style={styles.detailIcon}
          uri={getGovAppIconUrl(app, storeIcon)}
        />
        <AppText style={styles.detailName} variant="heading">
          {app.name}
        </AppText>
      </View>

      <View style={styles.actions}>
        <DirectoryLinkAction
          icon={<Download color={theme.palette.foreground} size={17} />}
          label="أندرويد"
          url={app.links.android}
        />
        <DirectoryLinkAction
          icon={<Download color={theme.palette.foreground} size={17} />}
          label="آيفون"
          url={app.links.apple}
        />
        <DirectoryLinkAction
          icon={<Globe2 color={theme.palette.foreground} size={17} />}
          label="الموقع الرسمي"
          url={app.links.official}
        />
      </View>

      {app.description ? <AppText>{app.description}</AppText> : null}

      {app.images.length > 0 ? (
        <View style={styles.screenshots}>
          <View style={styles.screenshotHeading}>
            <View style={styles.screenshotTitle}>
              <Images color={theme.palette.primary} size={19} />
              <AppText variant="label">لقطات الشاشة</AppText>
            </View>
            <AppText color="muted" variant="caption">
              {app.images.length} صور
            </AppText>
          </View>
          <ScrollView
            contentContainerStyle={styles.screenshotList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {app.images.map((image, index) => (
              <DirectoryImage
                accessibilityLabel={`لقطة شاشة ${index + 1} من ${app.name}`}
                key={`${app.id}-${image}`}
                style={styles.screenshot}
                uri={getGovAppScreenshotUrl(image)}
              />
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.noScreenshots}>
          <Smartphone color={theme.palette.mutedForeground} size={24} />
          <AppText color="muted" variant="caption">
            لا توجد لقطات شاشة متاحة
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  appIcon: {
    height: 110,
  },
  detail: {
    gap: 18,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 14,
  },
  detailIcon: {
    height: 72,
    width: 72,
  },
  detailName: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    minWidth: 104,
    width: '31%',
  },
  noScreenshots: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  screen: {
    gap: 16,
  },
  screenshot: {
    aspectRatio: 9 / 16,
    height: 280,
    width: 158,
  },
  screenshotHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  screenshotList: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  screenshots: {
    gap: 10,
  },
  screenshotTitle: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/GovApps/GovAppsClient.tsx (457 lines)
  confidence: high
  todos:      0
  notes:      Native modal, server media, store priority, and seven-day icon caching are preserved.
*/
