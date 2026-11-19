import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentStyle, Heading } from '../components';
import { NativeAction } from '../ui/native';
import { useTheme } from '../ui/theme';
import { PrayerSettingsFields } from './PrayerSettingsFields';
export function PrayerSettingsSheet({ visible, onClose }: { visible: boolean; onClose(): void }): React.JSX.Element {
  const { colors } = useTheme();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled"><View style={{ gap: 12 }}><Heading subtitle="الموقع وطريقة الحساب المشتركة مع الروزنامة والرئيسية">إعدادات المواقيت</Heading><NativeAction title="تم" systemImage="checkmark" onPress={onClose} /></View><PrayerSettingsFields /></ScrollView></SafeAreaView></Modal>;
}
