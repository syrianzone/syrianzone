import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';

export function CommentsSection({ placeId }: { placeId: number }) {
  const { isAdmin, login, user } = useAuth();
  const { theme } = useAppTheme();
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({ queryFn: () => placesApi.listComments(placeId, page), queryKey: ['places', placeId, 'comments', page] });
  const submit = async () => {
    if (!user) {
      await login();
      return;
    }
    const value = body.trim();
    if (!value) {
      return;
    }
    setPosting(true);
    try {
      await placesApi.addComment(placeId, value);
      setBody('');
      await query.refetch();
    } finally {
      setPosting(false);
    }
  };
  const remove = async (id: number) => {
    await placesApi.deleteComment(id);
    await query.refetch();
  };
  return (
    <View style={styles.root}>
      <AppText variant="heading">التعليقات</AppText>
      <TextInput maxLength={500} multiline onChangeText={setBody} placeholder="أضف تعليقًا" placeholderTextColor={theme.palette.mutedForeground} style={[styles.input, { borderColor: theme.palette.border, color: theme.palette.foreground }]} value={body} />
      <AppButton loading={posting} onPress={() => void submit()}>{user ? 'إرسال' : 'تسجيل الدخول للتعليق'}</AppButton>
      {query.data?.data.map((comment) => (
        <AppCard key={comment.id}>
          <AppText variant="label">{comment.user.name}</AppText>
          <AppText>{comment.body}</AppText>
          {user && (user.id === comment.user.id || isAdmin) ? <AppButton onPress={() => void remove(comment.id)} variant="danger">حذف</AppButton> : null}
        </AppCard>
      ))}
      {query.data?.current_page && query.data.current_page < query.data.last_page ? <AppButton onPress={() => setPage((value) => value + 1)} variant="secondary">عرض المزيد</AppButton> : null}
      {query.data?.data.length === 0 ? <AppText color="muted">لا توجد تعليقات بعد.</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({ input: { borderRadius: 12, borderWidth: 1, minHeight: 76, padding: 12, textAlign: 'right', textAlignVertical: 'top' }, root: { gap: 10 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/CommentsSection.tsx (160 lines)
  confidence: high
  todos:      0
  notes:      Native comments retain paging, authentication, creation, author or admin deletion, and retryable queries.
*/
