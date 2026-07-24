import { useRef, type PropsWithChildren, type ReactNode, type RefObject } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';

import { AppText } from './AppText';

interface ScreenProps {
  contentStyle?: ViewStyle;
  onContentSizeChange?: (width: number, height: number) => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  scrollViewRef?: RefObject<ScrollView | null>;
  subtitle?: string;
  title?: string;
  trailing?: ReactNode;
}

export function Screen({
  children,
  contentStyle,
  onContentSizeChange,
  onEndReached,
  onEndReachedThreshold = 120,
  onRefresh,
  refreshing = false,
  scroll = true,
  scrollViewRef,
  subtitle,
  title,
  trailing,
}: PropsWithChildren<ScreenProps>) {
  const { theme } = useAppTheme();
  const endReached = useRef(false);
  const content = (
    <View style={[styles.content, contentStyle]}>
      {title ? (
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <AppText variant="title">{title}</AppText>
            {subtitle ? <AppText color="muted">{subtitle}</AppText> : null}
          </View>
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.palette.background }]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={onContentSizeChange}
          onScroll={(event) => {
            if (!onEndReached) {
              return;
            }
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
            if (distance <= onEndReachedThreshold) {
              if (!endReached.current) {
                endReached.current = true;
                onEndReached();
              }
            } else {
              endReached.current = false;
            }
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                onRefresh={onRefresh}
                refreshing={refreshing}
                tintColor={theme.palette.primary}
              />
            ) : undefined
          }
          ref={scrollViewRef}
          scrollEventThrottle={100}
          testID="screen-scroll"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    width: '100%',
  },
  headingCopy: {
    flex: 1,
    gap: 2,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
});
