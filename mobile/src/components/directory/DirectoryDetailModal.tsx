import { X } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

interface DirectoryDetailModalProps {
  onClose: () => void;
  title: string;
  visible: boolean;
}

export function DirectoryDetailModal({
  children,
  onClose,
  title,
  visible,
}: PropsWithChildren<DirectoryDetailModalProps>) {
  const { theme } = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={[styles.overlay, { backgroundColor: theme.palette.overlay }]}
      >
        <SafeAreaView
          edges={['top', 'bottom']}
          style={[styles.sheet, { backgroundColor: theme.palette.background }]}
        >
          <View style={styles.header}>
            <AppText style={styles.title} variant="heading">
              {title}
            </AppText>
            <Pressable
              accessibilityLabel="إغلاق التفاصيل"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={styles.close}
            >
              <X color={theme.palette.foreground} size={22} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: '55%',
    overflow: 'hidden',
  },
  title: {
    flex: 1,
  },
});
