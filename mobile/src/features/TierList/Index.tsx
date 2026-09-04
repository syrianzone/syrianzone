// The government tier list is the poll screen with the website's framing: Arabic title, satire
// notice, touch hint, and a results button. PollShow keeps the data and board logic.
import { AlertCircle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import PollShow from '@/features/Polls/Show';

import TierListLeaderboard from './Leaderboard';

const governmentPoll = 'best-ministers';

export const tierListCopy = {
  hint: 'انقر على اسم الوزير ثم انقر على المكان في القائمة لنقله',
  notice:
    'هذه منصّة تصويت مجتمعيّة ذات طابع ساخر، وغايتها الترفيه والمناقشة فحسب. وما يُنشر من نتائج ليس استطلاعاً علميّاً، ولا يُمثّل رأياً رسميّاً، ولا يرتبط بأي جهة حكوميّة.',
  results: 'عرض النتائج',
  share:
    'يمكن حفظ صورة جاهزة لمشاركتها على السوشال ميديا بسهولة من خلال الزر الموجود في آخر الصفحة',
  title: 'تير ليست الحكومة السورية الجديدة',
} as const;

export default function TierListIndex() {
  const [results, setResults] = useState(false);
  return results ? (
    <TierListLeaderboard onVote={() => setResults(false)} />
  ) : (
    <PollShow
      identifier={governmentPoll}
      intro={<TierListIntro />}
      leaderboardLabel={tierListCopy.results}
      onLeaderboard={() => setResults(true)}
      title={tierListCopy.title}
    />
  );
}

function TierListIntro() {
  const { theme } = useAppTheme();
  return (
    <>
      <AppCard style={styles.card}>
        <View style={styles.noticeHeading}>
          <AlertCircle color={theme.palette.foreground} size={18} />
          <AppText variant="label">تنويه</AppText>
        </View>
        <AppText color="muted" variant="caption">{tierListCopy.notice}</AppText>
      </AppCard>
      <AppCard style={styles.card}>
        <AppText color="muted">{tierListCopy.share}</AppText>
        <AppText color="muted">{tierListCopy.hint}</AppText>
      </AppCard>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
  },
  noticeHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/TierList/Index.tsx (103 lines)
  confidence: high
  todos:      0
  notes:      The website framing (title, notice, touch hint, results button) wraps the shared native poll board.
*/
