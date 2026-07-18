import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';

export function RejectDialog({
  busy,
  onConfirm,
  onOpenChange,
  open,
}: {
  busy: boolean;
  onConfirm: (reason: string | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!open) {
    return null;
  }

  return (
    <AppCard style={styles.root}>
      <AppText variant="heading">رفض المكان</AppText>
      <AppText color="muted">
        سبب الرفض يظهر للمساهم ليتمكن من التحسين.
      </AppText>
      <AppInput
        accessibilityLabel="سبب الرفض"
        editable={!busy}
        maxLength={1000}
        multiline
        numberOfLines={6}
        onChangeText={setReason}
        placeholder="اكتب سبباً واضحاً يساعد المساهم على التحسين، مثال: الصور غير واضحة، أو الوصف لا يذكر ما يميز المكان"
        value={reason}
      />
      <View style={styles.actions}>
        <AppButton disabled={busy} onPress={() => onOpenChange(false)} variant="secondary">
          إلغاء
        </AppButton>
        <AppButton
          disabled={busy}
          onPress={() => onConfirm(reason.trim() || null)}
          variant="danger"
        >
          تأكيد الرفض
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  root: { gap: 10 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Places/RejectDialog.tsx (52 lines)
  confidence: high
  todos:      0
  notes:      Native rejection keeps optional bounded reasons, contributor disclosure, cancel, and confirmation.
*/
