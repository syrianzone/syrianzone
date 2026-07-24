import { Download, Globe2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  DirectoryCard,
  DirectoryImage,
  DirectoryLinkAction,
} from '@/components/directory';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { getGovAppIconUrl } from './data';
import type { GovApp } from './types';

const DEFAULT_GOVAPP_ICON =
  'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/govapps/mofa/icon.webp';

interface GovAppsClientProps {
  initialData: readonly GovApp[];
}

export default function GovAppsClient({ initialData }: GovAppsClientProps) {
  return (
    <View style={styles.grid}>
      {initialData.map((app) => (
        <View key={app.id} style={styles.gridItem}>
          <GovAppCard app={app} />
        </View>
      ))}
    </View>
  );
}

function GovAppCard({ app }: { app: GovApp }) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const iconUrl = getGovAppIconUrl(app);

  return (
    <DirectoryCard
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
          fallbackUri={DEFAULT_GOVAPP_ICON}
          style={styles.appIcon}
          uri={iconUrl}
        />
      }
      title={app.name}
    >
      {app.description ? (
        <Pressable
          accessibilityLabel={`وصف ${app.name}`}
          accessibilityHint={
            expanded ? 'اضغط لتقليص الوصف' : 'اضغط لإظهار الوصف كاملاً'
          }
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          testID={`govapp-description-${app.id}`}
        >
          <AppText
            color={expanded ? 'default' : 'muted'}
            numberOfLines={expanded ? undefined : 2}
            variant="caption"
          >
            {app.description}
          </AppText>
        </Pressable>
      ) : null}
    </DirectoryCard>
  );
}

const styles = StyleSheet.create({
  appIcon: {
    aspectRatio: 1,
    height: undefined,
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
});

/*
PORT STATUS
  source:     resources/js/Pages/GovApps/GovAppsClient.tsx (183 lines)
  confidence: high
  todos:      0
  notes:      Native cards use database R2 icons, safe store actions, and expandable descriptions without the removed screenshot gallery.
*/
