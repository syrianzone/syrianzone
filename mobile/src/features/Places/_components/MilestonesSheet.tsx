import { X } from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { GUIDE_LEVELS, LevelBadge, rankName } from './LevelBadge';

const POINT_RULES = [
  'مكان مقبول: 15 نقطة',
  'كل صورة على مكان مقبول: 5 نقاط',
  'وصف وافٍ (200 حرف أو أكثر): 5 نقاط إضافية',
  'كل حفظ يحصل عليه مكانك: نقطة واحدة',
] as const;

export function MilestonesSheet({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const { theme } = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={open}
    >
      <View style={[styles.overlay, { backgroundColor: theme.palette.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.palette.background }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText variant="heading">مستويات مشوار</AppText>
              <AppText color="muted" variant="caption">
                اجمع النقاط بمساهماتك في مشوار وارتقِ في المستويات.
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="إغلاق الرتب"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.close}
            >
              <X color={theme.palette.foreground} size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText variant="label">كيف تُحسب النقاط؟</AppText>
            {POINT_RULES.map((rule) => (
              <AppText color="muted" key={rule} variant="caption">• {rule}</AppText>
            ))}
            <AppText style={styles.sectionTitle} variant="label">الرتب</AppText>
            <View style={[styles.rank, { borderBottomColor: theme.palette.border }]}>
              <AppText color="muted" variant="caption">الرتبة</AppText>
              <AppText color="muted" variant="caption">النقاط المطلوبة</AppText>
            </View>
            {GUIDE_LEVELS.map((item) => (
              <View
                key={item.level}
                style={[styles.rank, { borderBottomColor: theme.palette.border }]}
              >
                <View style={styles.rankName}>
                  <LevelBadge level={item.level} />
                  <AppText>{rankName(item.level)}</AppText>
                  <AppText
                    accessibilityLabel={`رقم المستوى ${item.level}`}
                    color="muted"
                    variant="caption"
                  >
                    {item.level}
                  </AppText>
                </View>
                <AppText>{item.points}</AppText>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: { padding: 7 },
  content: { gap: 7, paddingBottom: 24 },
  header: { alignItems: 'flex-start', flexDirection: 'row-reverse', gap: 10 },
  headerCopy: { flex: 1, gap: 3 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  rank: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 42,
  },
  rankName: { alignItems: 'center', flexDirection: 'row-reverse', gap: 7 },
  sectionTitle: { marginTop: 10 },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
    maxHeight: '82%',
    padding: 18,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/MilestonesSheet.tsx (79 lines)
  confidence: high
  todos:      0
  notes:      Native bottom modal preserves the exact point rules, rank names, and ten thresholds.
*/
