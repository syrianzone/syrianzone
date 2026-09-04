import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { deterministicCandidateOrder } from '@/features/Polls/model';
import type {
  PollCandidate,
  PollGroup,
  PollSummary,
  PollTiers,
} from '@/lib/api/polls';

import { TierBoard } from './TierBoard';

const poll: PollSummary = {
  id: 'poll-1',
  isActive: true,
  slug: 'best-ministers',
  timezone: 'Asia/Damascus',
  title: 'أفضل الوزراء',
};
const groups: PollGroup[] = [
  {
    id: 'ministers',
    isDefault: true,
    key: 'minister',
    name: 'الوزراء',
    pollId: poll.id,
    sortOrder: 0,
  },
];
const candidates: PollCandidate[] = ['الأول', 'الثاني', 'الثالث'].map(
  (name, index) => ({
    archiveReason: null,
    category: 'minister',
    groupId: 'ministers',
    id: `candidate-${index + 1}`,
    imageUrl: null,
    name,
    status: 'active' as const,
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: null,
  }),
);

async function renderBoard(
  onVote = jest.fn(async (_tiers: PollTiers) => undefined),
) {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <TierBoard
          candidates={candidates}
          groups={groups}
          onVote={onVote}
          poll={poll}
          voteDay="2026-07-15"
        />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  return { onVote, view };
}

test('moves multiple candidates to a tier and submits ordered assignments', async () => {
  const { onVote, view } = await renderBoard();

  for (const candidate of candidates) {
    await fireEvent.press(view.getByLabelText(`اختيار ${candidate.name}`));
  }
  await fireEvent.press(view.getByLabelText('نقل المحددين إلى ممتاز'));
  await fireEvent.press(view.getByText('تسجيل التصويت'));

  await waitFor(() => expect(onVote).toHaveBeenCalledTimes(1));
  expect(onVote.mock.calls[0]?.[0].S).toEqual(
    deterministicCandidateOrder(candidates, poll.id, '2026-07-15').map(
      ({ id: candidateId }, pos) => ({ candidateId, pos }),
    ),
  );
  expect(view.getByText('تم تسجيل التصويت')).toBeTruthy();
});

test('blocks a ballot below the minimum selection count', async () => {
  const { onVote, view } = await renderBoard();

  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  await fireEvent.press(view.getByLabelText('نقل المحددين إلى ممتاز'));
  await fireEvent.press(view.getByText('تسجيل التصويت'));

  expect(onVote).not.toHaveBeenCalled();
  expect(view.getByText('اختر 3 مرشحين على الأقل قبل التصويت.')).toBeTruthy();
});

test('returns a placed candidate to the bank without resetting the board', async () => {
  const { view } = await renderBoard();

  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  await fireEvent.press(view.getByLabelText('المستوى ممتاز'));
  expect(
    within(view.getByLabelText('المستوى ممتاز')).getByLabelText('اختيار الأول'),
  ).toBeTruthy();

  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  await fireEvent.press(view.getByText('إعادة إلى القائمة'));

  expect(
    within(view.getByLabelText('المستوى ممتاز')).queryByLabelText('اختيار الأول'),
  ).toBeNull();
  expect(view.getByLabelText('اختيار الأول')).toBeTruthy();
});

test('moves a placed candidate to another tier by tapping that tier row', async () => {
  const { view } = await renderBoard();

  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  await fireEvent.press(view.getByLabelText('المستوى ممتاز'));
  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  await fireEvent.press(view.getByLabelText('المستوى جيد'));

  expect(
    within(view.getByLabelText('المستوى ممتاز')).queryByLabelText('اختيار الأول'),
  ).toBeNull();
  expect(
    within(view.getByLabelText('المستوى جيد')).getByLabelText('اختيار الأول'),
  ).toBeTruthy();
});

test('clears the selection after every move so the next tap starts fresh', async () => {
  const { view } = await renderBoard();

  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  expect(view.getByText('نقل 1 من المحددين إلى:')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('المستوى ممتاز'));
  expect(view.queryByText('نقل 1 من المحددين إلى:')).toBeNull();

  await fireEvent.press(view.getByLabelText('اختيار الأول'));
  await fireEvent.press(view.getByText('إعادة إلى القائمة'));
  expect(view.queryByText('نقل 1 من المحددين إلى:')).toBeNull();
  expect(view.queryByText('إعادة إلى القائمة')).toBeNull();
});
