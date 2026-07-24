import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  MessageCircle,
  Phone,
  Search,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  DirectoryAction,
  DirectoryCard,
  DirectoryFilterChips,
  DirectoryLinkAction,
  DirectoryScreen,
  DirectorySearchField,
  DirectoryViewToggle,
  getDirectoryQueryPresentation,
} from '@/components/directory';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  directoryQueryKeys,
  fetchPhonebook,
} from '@/lib/api/directories';

import {
  filterPhonebookEntries,
  getPhonebookCategories,
  getTelephoneUrl,
  getWhatsAppUrl,
  type PhonebookEntry,
} from './logic';

export default function Index() {
  const query = useQuery({
    queryFn: ({ signal }) => fetchPhonebook({ signal }),
    queryKey: directoryQueryKeys.phonebook,
  });
  const entries = query.data;
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
          ? 'تعذر تحميل دليل الهاتف. تحقق من اتصالك وحاول مرة أخرى.'
          : undefined
      }
      isLoading={state.loading}
      loadingLabel="جاري تحميل دليل الهاتف والواتساب..."
      onRetry={retry}
      refreshing={state.refreshing}
      subtitle="أرقام التواصل والشكاوى والطوارئ للجهات الرسمية والخدمية السورية"
      title="دليل الهاتف والواتساب"
    >
      {entries ? <PhonebookDirectory entries={entries} /> : null}
    </DirectoryScreen>
  );
}

export function PhonebookDirectory({
  entries,
}: {
  entries: readonly PhonebookEntry[];
}) {
  const { theme } = useAppTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCategory, setCurrentCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categories = useMemo(() => getPhonebookCategories(entries), [entries]);
  const filteredEntries = useMemo(
    () => filterPhonebookEntries(entries, currentCategory, searchTerm),
    [currentCategory, entries, searchTerm],
  );

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const copyNumber = async (entry: PhonebookEntry) => {
    try {
      await Clipboard.setStringAsync(entry.number);
    } catch {
      return;
    }
    setCopiedId(entry.id);
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopiedId(null), 2_000);
  };

  return (
    <View style={styles.screen}>
      <DirectorySearchField
        accessibilityLabel="البحث في دليل الهاتف"
        onChangeText={setSearchTerm}
        placeholder="ابحث بالجهة، القسم، أو رقم الهاتف..."
        value={searchTerm}
      />
      <DirectoryFilterChips
        label="القسم"
        onSelect={setCurrentCategory}
        options={categories.map((category) => ({
          label: category.labelAr,
          value: category.key,
        }))}
        selected={currentCategory}
      />

      <View style={styles.controls}>
        <AppText color="muted" variant="caption">
          {filteredEntries.length > 0
            ? `عرض ${filteredEntries.length} رقم تواصل رسمي`
            : 'لم يتم العثور على أرقام تطابق البحث'}
        </AppText>
        <DirectoryViewToggle
          first={{ label: 'بطاقات', value: 'grid' }}
          onChange={setViewMode}
          second={{ label: 'قائمة', value: 'table' }}
          value={viewMode}
        />
      </View>

      {searchTerm || currentCategory !== 'all' ? (
        <AppButton
          onPress={() => {
            setSearchTerm('');
            setCurrentCategory('all');
          }}
          variant="secondary"
        >
          مسح الفلاتر
        </AppButton>
      ) : null}

      {filteredEntries.length === 0 ? (
        <AppCard style={styles.empty}>
          <Search color={theme.palette.mutedForeground} size={40} />
          <AppText variant="heading">لا توجد نتائج</AppText>
          <AppText color="muted">
            جرب تعديل كلمات البحث أو الفلاتر.
          </AppText>
        </AppCard>
      ) : (
        <View style={viewMode === 'grid' ? styles.grid : styles.list}>
          {filteredEntries.map((entry) => (
            <View
              key={entry.id}
              style={viewMode === 'grid' ? styles.gridItem : undefined}
            >
              <DirectoryCard
                actions={
                  <PhonebookActions
                    copied={copiedId === entry.id}
                    entry={entry}
                    onCopy={() => {
                      void copyNumber(entry);
                    }}
                  />
                }
                badges={[
                  entry.category_ar,
                  entry.is_whatsapp
                    ? viewMode === 'grid'
                      ? 'واتساب'
                      : 'اتصال + واتساب'
                    : viewMode === 'table'
                      ? 'اتصال فقط'
                      : '',
                ].filter(Boolean)}
                compact={viewMode === 'table'}
                subtitle={viewMode === 'grid' ? entry.name_en : undefined}
                title={entry.name_ar}
              >
                <AppText style={styles.number} variant="heading">
                  {entry.number}
                </AppText>
              </DirectoryCard>
            </View>
          ))}
        </View>
      )}

      <AppCard style={styles.note}>
        <View style={styles.noteTitle}>
          <Info color={theme.palette.primary} size={21} />
          <AppText style={styles.noteCopy} variant="label">
            ملاحظات حول أرقام الدليل الخدمي
          </AppText>
        </View>
        <AppText color="muted" variant="caption">
          تم جمع وتدقيق هذا الدليل من القرارات والبيانات الرسمية الصادرة عن
          الوزارات ومجالس المحافظات السورية. بعض الأرقام مخصصة لقنوات المراسلة
          الفورية مثل واتساب، بينما تعمل الأرقام المختصرة وخطوط الهاتف الأرضي
          للاستجابة السريعة على مستوى الشبكات المحلية.
        </AppText>
      </AppCard>
    </View>
  );
}

function PhonebookActions({
  copied,
  entry,
  onCopy,
}: {
  copied: boolean;
  entry: PhonebookEntry;
  onCopy: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <>
      <DirectoryAction
        icon={
          copied ? (
            <Check color={theme.palette.success} size={16} />
          ) : (
            <Copy color={theme.palette.foreground} size={16} />
          )
        }
        label={copied ? 'تم النسخ' : 'نسخ الرقم'}
        onPress={onCopy}
      />
      <DirectoryLinkAction
        icon={<Phone color={theme.palette.primary} size={16} />}
        label="اتصال هاتفي"
        url={getTelephoneUrl(entry.number)}
      />
      <DirectoryLinkAction
        disabledWhenMissing
        icon={<MessageCircle color={theme.palette.success} size={16} />}
        label="مراسلة عبر واتساب"
        url={entry.is_whatsapp ? getWhatsAppUrl(entry.number) : undefined}
      />
      <DirectoryLinkAction
        disabledWhenMissing
        icon={<ExternalLink color={theme.palette.foreground} size={16} />}
        label="عرض المصدر"
        url={entry.source_url}
      />
    </>
  );
}

const styles = StyleSheet.create({
  controls: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 220,
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    minWidth: 155,
    width: '48%',
  },
  list: {
    gap: 10,
  },
  note: {
    gap: 10,
    marginTop: 8,
  },
  noteCopy: {
    flex: 1,
  },
  noteTitle: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  number: {
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  screen: {
    gap: 16,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Phonebook/Index.tsx (466 lines)
  confidence: high
  todos:      0
  notes:      Native clipboard, safe calling links, and validated query states preserve directory behavior.
*/
