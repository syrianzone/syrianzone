import type { ReactNode } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentStyle, Heading } from '../components';
import { NativeAction } from '../ui/native';
import { useTheme } from '../ui/theme';

export function EditorSheet({ title, visible, close, children }: {
  title: string; visible: boolean; close(): void; children: ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();
  return <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" allowSwipeDismissal={false} onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <Heading>{title}</Heading><NativeAction title="إغلاق" onPress={close} />{children}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
