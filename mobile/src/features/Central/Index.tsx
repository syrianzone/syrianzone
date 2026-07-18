import {
  Building2,
  Globe2,
  Info,
  Landmark,
  Link2,
  Phone,
  Send,
  Smartphone,
  Sparkles,
  UserRound,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  DirectoryDetailModal,
  DirectoryFilterChips,
  DirectoryImage,
  DirectoryLinkAction,
  DirectorySearchField,
} from '@/components/directory';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { GovernorateIcon } from '@/features/Transit/_components/landing/GovernorateIcon';
import { resolveDirectoryImageUrl } from '@/lib/api/directories';

import { centralDirectoryData } from './data/central-directory';
import {
  centralCategoryLabel,
  type CentralCategory,
  type CentralDirectoryData,
  type CentralDirectoryItem,
  centralDirectoryItems,
  centralLinkTypeLabel,
  centralLinkUrl,
  filterCentralDirectoryItems,
} from './model';

const categoryOptions: readonly { label: string; value: CentralCategory }[] = [
  { label: 'الكل', value: 'all' },
  { label: 'المحافظات', value: 'governorates' },
  { label: 'الهيئات', value: 'entities' },
  { label: 'الوزارات', value: 'ministries' },
];

export default function CentralDirectoryScreen() {
  return (
    <Screen
      subtitle="دليل المحافظات السورية وهيكلية الرئاسة والوزارات واللجان"
      title="الدليل المركزي السوري"
    >
      <CentralDirectory data={centralDirectoryData} />
    </Screen>
  );
}

export function CentralDirectory({ data }: { data: CentralDirectoryData }) {
  const { theme } = useAppTheme();
  const [category, setCategory] = useState<CentralCategory>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CentralDirectoryItem | null>(null);
  const items = useMemo(() => centralDirectoryItems(data), [data]);
  const filtered = useMemo(
    () => filterCentralDirectoryItems(items, category, search),
    [category, items, search],
  );

  return (
    <View style={styles.root}>
      <DirectorySearchField
        accessibilityLabel="البحث في الدليل المركزي"
        onChangeText={setSearch}
        placeholder="ابحث عن محافظة، وزارة، هيئة، مسؤول..."
        value={search}
      />
      <DirectoryFilterChips
        onSelect={setCategory}
        options={categoryOptions}
        selected={category}
      />

      {filtered.length ? (
        <View style={styles.grid}>
          {filtered.map((item) => (
            <Pressable
              accessibilityLabel={`عرض تفاصيل ${item.name}`}
              accessibilityRole="button"
              key={`${item.category}-${item.id}`}
              onPress={() => setSelected(item)}
              style={({ pressed }) => [
                styles.gridItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <AppCard style={styles.card}>
                <View
                  style={[
                    styles.media,
                    { backgroundColor: theme.palette.surfaceRaised },
                  ]}
                >
                  <CentralMedia item={item} />
                </View>
                <AppText numberOfLines={2} style={styles.center} variant="label">
                  {item.name}
                </AppText>
                <AppText
                  color="muted"
                  numberOfLines={1}
                  style={styles.center}
                  variant="caption"
                >
                  {item.category === 'governorates'
                    ? item.subtitle
                    : `المسؤول: ${item.subtitle}`}
                </AppText>
              </AppCard>
            </Pressable>
          ))}
        </View>
      ) : (
        <AppCard style={styles.empty}>
          <Info color={theme.palette.mutedForeground} size={24} />
          <AppText color="muted" variant="caption">
            لا توجد نتائج تطابق خيارات البحث الحالية.
          </AppText>
        </AppCard>
      )}

      <DirectoryDetailModal
        onClose={() => setSelected(null)}
        title={selected?.category === 'governorates'
          ? `محافظة ${selected.name}`
          : selected?.name ?? ''}
        visible={selected !== null}
      >
        {selected ? <CentralDetails item={selected} /> : null}
      </DirectoryDetailModal>
    </View>
  );
}

function CentralMedia({ item }: { item: CentralDirectoryItem }) {
  const { theme } = useAppTheme();
  if (item.category === 'governorates') {
    return (
      <GovernorateIcon
        cityId={item.id}
        color={theme.palette.primary}
        size={42}
      />
    );
  }
  if (item.image) {
    return (
      <DirectoryImage
        accessibilityLabel={item.subtitle}
        style={styles.image}
        uri={resolveDirectoryImageUrl(`/syofficial-assets/${item.image}`)}
      />
    );
  }
  const Icon = item.category === 'entities' ? Landmark : Building2;
  return <Icon color={theme.palette.primary} size={30} />;
}

function CentralDetails({ item }: { item: CentralDirectoryItem }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.details}>
      <View style={styles.detailHeading}>
        <View
          style={[
            styles.detailMedia,
            { backgroundColor: theme.palette.surfaceRaised },
          ]}
        >
          <CentralMedia item={item} />
        </View>
        <View style={styles.detailCopy}>
          <AppText color="primary" variant="caption">
            {centralCategoryLabel(item.category)}
          </AppText>
          <AppText variant="heading">
            {item.category === 'governorates'
              ? `محافظة ${item.name}`
              : item.name}
          </AppText>
          {item.head ? (
            <View style={styles.responsible}>
              <UserRound color={theme.palette.mutedForeground} size={16} />
              <AppText color="muted" style={styles.detailCopy} variant="caption">
                {item.category === 'ministries'
                  ? `الوزير المسؤول: ${item.head}`
                  : `الرئيس/المدير المسؤول: ${item.head}`}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <AppText color="muted" variant="label">
        قنوات الاتصال والروابط الرسمية
      </AppText>
      {item.links.length ? (
        <View style={styles.links}>
          {item.links.map((link, index) => {
            const url = centralLinkUrl(link);
            return url ? (
              <AppCard key={`${link.type}-${link.value}-${index}`} style={styles.linkCard}>
                <View style={styles.linkCopy}>
                  {centralLinkIcon(link.type, theme.palette.primary)}
                  <View style={styles.detailCopy}>
                    <AppText color="muted" variant="caption">
                      {centralLinkTypeLabel(link.type)}
                    </AppText>
                    <DirectoryLinkAction label={link.label} url={url} />
                  </View>
                </View>
              </AppCard>
            ) : (
              <AppCard key={`${link.type}-${link.value}-${index}`} style={styles.linkCard}>
                <AppText variant="label">{link.label}</AppText>
                <AppText color="muted" variant="caption">{link.value}</AppText>
              </AppCard>
            );
          })}
        </View>
      ) : (
        <AppCard style={styles.emptyLinks}>
          <Info color={theme.palette.mutedForeground} size={18} />
          <AppText color="muted" variant="caption">
            لا توجد روابط اتصال مسجلة حالياً
          </AppText>
        </AppCard>
      )}
    </View>
  );
}

function centralLinkIcon(type: string, color: string): ReactNode {
  switch (type) {
    case 'website':
      return <Globe2 color={color} size={18} />;
    case 'telegram':
      return <Send color={color} size={18} />;
    case 'x':
      return <Sparkles color={color} size={18} />;
    case 'app':
      return <Smartphone color={color} size={18} />;
    case 'phone':
      return <Phone color={color} size={18} />;
    case 'facebook':
      return <Landmark color={color} size={18} />;
    default:
      return <Link2 color={color} size={18} />;
  }
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    minHeight: 176,
  },
  center: {
    textAlign: 'center',
  },
  detailCopy: {
    flex: 1,
    gap: 3,
  },
  detailHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  detailMedia: {
    alignItems: 'center',
    borderRadius: 16,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  details: {
    gap: 16,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    minHeight: 180,
    justifyContent: 'center',
  },
  emptyLinks: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
  image: {
    borderRadius: 14,
    height: 64,
    width: 64,
  },
  linkCard: {
    gap: 6,
    padding: 12,
  },
  linkCopy: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  links: {
    gap: 8,
  },
  media: {
    alignItems: 'center',
    borderRadius: 16,
    height: 68,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 68,
  },
  responsible: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  root: {
    gap: 16,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Central/Index.tsx (468 lines)
  confidence: high
  todos:      0
  notes:      The native direct route preserves search, category filters, cards, details, and safe official actions.
*/
