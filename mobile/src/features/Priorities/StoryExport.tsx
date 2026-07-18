import { Download, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  getThemeById,
  THEME_REGISTRY,
  type ConcreteThemeId,
} from '@/lib/ported/theme';

import type { Topic } from './data';
import { RadarChart } from './RadarChart';
import { sharePriorityStory } from './sharing';

interface StoryExportProps {
  onClose: () => void;
  open: boolean;
  persona: string;
  selectedNames: readonly string[];
  topics: readonly Topic[];
}

const storyThemes = THEME_REGISTRY.filter(
  (entry): entry is typeof entry & { id: ConcreteThemeId } =>
    entry.id !== 'system' && entry.priorities !== undefined,
);

export function StoryExport({
  onClose,
  open,
  persona,
  selectedNames,
  topics,
}: StoryExportProps) {
  const { theme } = useAppTheme();
  const [themeId, setThemeId] = useState<ConcreteThemeId>(
    theme.id === 'system' ? 'dark' : theme.id,
  );
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const target = useRef<View>(null);

  const storyTheme = getThemeById(themeId) ?? getThemeById('dark')!;
  const colors = storyTheme.priorities!;
  const foreground = storyTheme.isDark ? '#ffffff' : '#172033';
  const muted = storyTheme.isDark ? '#cbd5e1' : '#475569';
  const sorted = useMemo(
    () => [...topics].sort((a, b) => b.points - a.points),
    [topics],
  );

  const exportStory = async () => {
    if (!target.current) {
      return;
    }
    setExporting(true);
    setMessage(null);
    try {
      const shared = await sharePriorityStory(target.current);
      setMessage(
        shared
          ? 'تم تجهيز بطاقة القصة وفتح خيارات المشاركة.'
          : 'المشاركة غير متاحة على هذا الجهاز.',
      );
    } catch {
      setMessage('تعذر إنشاء بطاقة القصة. حاول مرة أخرى.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={open}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.palette.surface }]}>
          <View style={styles.header}>
            <AppText variant="heading">بطاقة القصة</AppText>
            <Pressable
              accessibilityLabel="إغلاق بطاقة القصة"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.close}
            >
              <X color={theme.palette.foreground} size={24} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {storyThemes.map((entry) => (
              <Pressable
                accessibilityRole="button"
                key={entry.id}
                onPress={() => setThemeId(entry.id)}
                style={[
                  styles.themeChoice,
                  {
                    backgroundColor: entry.previewBackground,
                    borderColor:
                      entry.id === themeId
                        ? theme.palette.primary
                        : theme.palette.border,
                  },
                ]}
              >
                <AppText style={{ color: entry.isDark ? '#ffffff' : '#172033' }} variant="caption">
                  {entry.emoji} {entry.shortNameAr ?? entry.nameAr}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.previewScroll}>
            <View
              collapsable={false}
              ref={target}
              style={[
                styles.story,
                {
                  backgroundColor: storyTheme.palette.background,
                  borderColor: colors.urlText,
                },
              ]}
            >
              <View style={styles.storyHeader}>
                <View>
                  <AppText style={[styles.storyBrand, { color: foreground }]}>المساحة السورية</AppText>
                  <AppText style={[styles.storySubtitle, { color: colors.headerSubtitle }]}>بوصلة أولويات العمل بعد التحرير</AppText>
                </View>
                <AppText style={[styles.storyFlag, { color: foreground }]}>🇸🇾</AppText>
              </View>

              <RadarChart
                gridColor={storyTheme.palette.border}
                labelColor={muted}
                primaryColor={colors.urlText}
                size={180}
                topics={topics}
              />

              <View
                style={[
                  styles.persona,
                  { backgroundColor: colors.badgeBackground },
                ]}
              >
                <AppText style={[styles.personaCaption, { color: colors.accentText }]}>بروفايلي التوافقي</AppText>
                <AppText style={[styles.personaTitle, { color: foreground }]}>{persona}</AppText>
              </View>

              <View style={styles.ranking}>
                {sorted.map((topic, index) => (
                  <View key={topic.id} style={styles.rankRow}>
                    <AppText style={[styles.rankName, { color: foreground }]}>
                      {index + 1}. {topic.emoji} {topic.name}
                    </AppText>
                    <AppText style={[styles.rankValue, { color: colors.urlText }]}>%{topic.points}</AppText>
                  </View>
                ))}
              </View>

              {selectedNames.length > 0 ? (
                <AppText
                  numberOfLines={2}
                  style={[styles.selected, { color: muted }]}
                >
                  الملفات الملحة: {selectedNames.join('، ')}
                </AppText>
              ) : null}
              <AppText style={[styles.storyUrl, { color: colors.urlText }]}>syrian.zone/priorities</AppText>
            </View>
          </ScrollView>

          {message ? <AppText color="muted" variant="caption">{message}</AppText> : null}
          <AppButton
            icon={<Download color={theme.palette.primaryForeground} size={18} />}
            loading={exporting}
            onPress={() => void exportStory()}
          >
            إنشاء ومشاركة الصورة
          </AppButton>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  persona: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  personaCaption: {
    fontSize: 8,
    lineHeight: 11,
    textAlign: 'center',
  },
  personaTitle: {
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  previewScroll: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  rankName: {
    flex: 1,
    fontSize: 7.5,
    lineHeight: 11,
  },
  ranking: {
    gap: 2,
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
  },
  rankValue: {
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
    fontSize: 8,
    lineHeight: 11,
    minWidth: 24,
    textAlign: 'left',
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  selected: {
    fontSize: 7,
    lineHeight: 10,
    textAlign: 'center',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 10,
    maxHeight: '96%',
    padding: 16,
  },
  story: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    height: 512,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: 14,
    width: 288,
  },
  storyBrand: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    lineHeight: 17,
  },
  storyFlag: {
    fontSize: 24,
  },
  storyHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  storySubtitle: {
    fontSize: 7,
    lineHeight: 10,
  },
  storyUrl: {
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  themeChoice: {
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Priorities/PrioritiesApp.tsx (1596 lines)
  confidence: high
  todos:      0
  notes:      A captured native 9:16 view preserves themed story preview and export.
*/
