import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';

const reasons = [['spam', 'مزعج'], ['wrong_info', 'معلومات خاطئة'], ['inappropriate', 'غير لائق'], ['duplicate', 'مكرر'], ['other', 'أخرى']] as const;

export function ReportButton({ placeId }: { placeId: number }) {
  const { login, user } = useAuth();
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');
  const submit = async () => {
    if (!user) {
      await login();
      return;
    }
    if (!reason) {
      return;
    }
    const response = await placesApi.report(placeId, reason, details.trim() || undefined);
    setMessage(response.message);
  };
  if (!open) {
    return <AppButton onPress={() => setOpen(true)} variant="ghost">إبلاغ</AppButton>;
  }
  return (
    <AppCard style={styles.root}>
      <AppText variant="label">الإبلاغ عن مكان</AppText>
      <View style={styles.reasons}>{reasons.map(([key, label]) => <Pressable key={key} onPress={() => setReason(key)} style={[styles.reason, { borderColor: reason === key ? theme.palette.primary : theme.palette.border }]}><AppText variant="caption">{label}</AppText></Pressable>)}</View>
      <TextInput maxLength={1000} multiline onChangeText={setDetails} placeholder="تفاصيل اختيارية" placeholderTextColor={theme.palette.mutedForeground} style={[styles.input, { borderColor: theme.palette.border, color: theme.palette.foreground }]} value={details} />
      <AppButton disabled={!reason} onPress={() => void submit()}>{user ? 'إرسال البلاغ' : 'تسجيل الدخول للإبلاغ'}</AppButton>
      <AppButton onPress={() => setOpen(false)} variant="ghost">إغلاق</AppButton>
      {message ? <AppText color="success">{message}</AppText> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({ input: { borderRadius: 12, borderWidth: 1, minHeight: 72, padding: 10, textAlign: 'right' }, reason: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }, reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, root: { gap: 10 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/ReportButton.tsx (130 lines)
  confidence: high
  todos:      0
  notes:      Native report reasons, details, auth prompt, success state, and submission are preserved.
*/
