import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootNavigation } from '../../navigation';
import { Heading, Label, contentStyle } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { NativeKeyCommands, type NativeKeyCommandsProps } from '../../platform/NativeKeyCommands';
export function GameShell({ title, rules, actions, children, keyboardCommands }: { title: string; rules: string[]; actions?: ReactNode; children: ReactNode; keyboardCommands?: NativeKeyCommandsProps }): React.JSX.Element {
  const { colors } = useTheme();
  const [showRules, setShowRules] = useState(false);
  const [rulesPresented, setRulesPresented] = useState(false), rulesBlocking = useRef(false);
  const [focus, setFocus] = useState(false);
  const navigation = useNavigation<RootNavigation>();
  useLayoutEffect(() => { navigation.setOptions({ headerShown: !focus, statusBarHidden: focus }); return () => navigation.setOptions({ headerShown: true, statusBarHidden: false }); }, [focus, navigation]);
  return <SafeAreaView edges={focus ? ['top', 'bottom'] : ['bottom']} style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={contentStyle}>
    {!focus ? <Heading>{title}</Heading> : null}<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><NativeAction title="القوانين" systemImage="book" onPress={() => { rulesBlocking.current = true; setRulesPresented(true); setShowRules(true); }} /></View><View style={{ flex: 1 }}><NativeAction title={focus ? 'إنهاء التركيز' : 'تركيز'} systemImage={focus ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right'} onPress={() => setFocus(value => !value)} /></View></View>
    {actions}{children}
  </ScrollView>{keyboardCommands ? <NativeKeyCommands {...keyboardCommands} active={!rulesPresented && keyboardCommands.active !== false}
    onKey={key => { if (!rulesBlocking.current) keyboardCommands.onKey(key); }} /> : null}
  <Modal visible={showRules} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setShowRules(false)} onDismiss={() => { rulesBlocking.current = false; setRulesPresented(false); }}><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ ...contentStyle, paddingTop: 30 }}><Heading>قوانين {title}</Heading>{rules.map((rule, i) => <Label key={i}>{rule}</Label>)}<NativeAction title="تم" onPress={() => setShowRules(false)} /></ScrollView></Modal></SafeAreaView>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/GameShell.tsx; confidence medium; todos 1 native focus and safe-area verification.
