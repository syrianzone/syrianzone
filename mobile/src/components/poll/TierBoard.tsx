import { Download, RotateCcw, Share2, Undo2, Vote } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  assignedCandidateCount,
  candidatesForGroup,
  createEmptyBoard,
  defaultGroupId,
  deterministicCandidateOrder,
  moveCandidatesToTier,
  moveCandidateWithinTier,
  returnCandidatesToBank,
  serializeBoard,
  switchCandidateGroup,
  TIER_KEYS,
  TIER_LABELS,
  toggleBoardSelection,
  validateBoard,
  type TierBoardState,
} from '@/features/Polls/model';
import {
  createAndShareCandidateArchive,
  shareCapturedPollImage,
} from '@/features/Polls/sharing';
import { ApiError } from '@/lib/api/errors';
import {
  submitPollVote,
  type PollCandidate,
  type PollGroup,
  type PollSummary,
  type PollTiers,
} from '@/lib/api/polls';
import {
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

import { TierAvatar } from './TierAvatar';

interface TierBoardProps {
  candidates: readonly PollCandidate[];
  groups: readonly PollGroup[];
  minimumSelections?: number;
  onVote?: (tiers: PollTiers) => Promise<void>;
  poll: PollSummary;
  title?: string;
  voteDay: string;
}

const tierColors = {
  S: '#ef4444',
  A: '#f97316',
  B: '#eab308',
  C: '#22c55e',
  D: '#3b82f6',
  F: '#8b5cf6',
} as const;

function cooldownKey(pollId: string, voteDay: string): string {
  return `submitCooldown:${pollId}:${voteDay}`;
}

export function TierBoard({
  candidates,
  groups,
  minimumSelections = 3,
  onVote,
  poll,
  title,
  voteDay,
}: TierBoardProps) {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  const [groupId, setGroupId] = useState(() => defaultGroupId(groups));
  const [board, setBoard] = useState<TierBoardState>(createEmptyBoard);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const captureTarget = useRef<View>(null);
  const selectedGroup = groups.find(({ id }) => id === groupId) ?? null;
  const visibleCandidates = useMemo(
    () => deterministicCandidateOrder(
      candidatesForGroup(candidates, groupId, selectedGroup?.key),
      poll.id,
      voteDay,
    ),
    [candidates, groupId, poll.id, selectedGroup?.key, voteDay],
  );
  const candidateById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );
  const assigned = new Set(TIER_KEYS.flatMap((key) => board.tiers[key]));
  const bank = visibleCandidates.filter(({ id }) => !assigned.has(id));
  const canReturnToBank = board.selected.some((id) => assigned.has(id));

  const selectGroup = (nextGroupId: string) => {
    setGroupId(nextGroupId);
    setBoard((current) => switchCandidateGroup(current));
    setError(null);
    setSuccess(null);
  };
  const submit = async () => {
    const validationError = validateBoard(board, minimumSelections);
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const stored = Number(await readStringPreference(cooldownKey(poll.id, voteDay)));
      if (Number.isFinite(stored) && Date.now() - stored < 60_000) {
        setError('يرجى الانتظار دقيقة قبل إرسال تصويت جديد.');
        return;
      }
      const tiers = serializeBoard(board);
      if (onVote) {
        await onVote(tiers);
      } else {
        await submitPollVote(poll.slug, tiers);
      }
      await writeStringPreference(cooldownKey(poll.id, voteDay), String(Date.now()));
      setSuccess('تم تسجيل التصويت');
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === 'already_voted_today'
          ? 'تم تسجيل تصويت من هذا الجهاز لهذا الاستطلاع اليوم.'
          : 'تعذر تسجيل التصويت. تحقق من اتصالك وحاول مرة أخرى.',
      );
    } finally {
      setBusy(false);
    }
  };
  const shareBoard = async () => {
    setSharing(true);
    setError(null);
    try {
      const shared = await shareCapturedPollImage(captureTarget);
      if (!shared) {
        setError('المشاركة غير متاحة على هذا الجهاز.');
      }
    } catch {
      setError('تعذر إنشاء صورة قائمة الترتيب.');
    } finally {
      setSharing(false);
    }
  };
  const shareArchive = async () => {
    setSharing(true);
    setError(null);
    try {
      await createAndShareCandidateArchive(visibleCandidates);
    } catch {
      setError('تعذر إنشاء أرشيف صور المرشحين.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      {groups.length > 1 ? (
        <View
          accessibilityRole="tablist"
          style={[
            styles.groupTabs,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
          ]}
        >
          {groups.map((group) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: group.id === groupId }}
              key={group.id}
              onPress={() => selectGroup(group.id)}
              style={[
                styles.groupTab,
                {
                  backgroundColor:
                    group.id === groupId
                      ? theme.palette.primary
                      : theme.palette.surface,
                  borderColor: theme.palette.border,
                },
              ]}
            >
              <AppText
                style={{
                  color:
                    group.id === groupId
                      ? theme.palette.primaryForeground
                      : theme.palette.foreground,
                }}
                variant="label"
              >
                {group.name}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {board.selected.length > 0 ? (
        <AppCard style={styles.bulkPanel}>
          <AppText variant="label">نقل {board.selected.length} من المحددين إلى:</AppText>
          <View style={styles.bulkButtons}>
            {TIER_KEYS.map((key) => (
              <Pressable
                accessibilityLabel={`نقل المحددين إلى ${TIER_LABELS[key]}`}
                accessibilityRole="button"
                key={key}
                onPress={() =>
                  setBoard((current) =>
                    moveCandidatesToTier(current, key, visibleCandidates),
                  )
                }
                style={[styles.tierMove, { backgroundColor: tierColors[key] }]}
              >
                <AppText style={styles.tierMoveText} variant="label">
                  {key}
                </AppText>
              </Pressable>
            ))}
          </View>
          {canReturnToBank ? (
            <AppButton
              icon={<Undo2 color={theme.palette.foreground} size={18} />}
              onPress={() => setBoard(returnCandidatesToBank)}
              variant="secondary"
            >
              إعادة إلى القائمة
            </AppButton>
          ) : null}
        </AppCard>
      ) : null}

      <View ref={captureTarget} style={styles.captureBoard}>
        <AppText style={styles.captureTitle} variant="heading">
          {title ?? poll.title}
        </AppText>
        {TIER_KEYS.map((tier) => (
          <Pressable
            accessibilityHint="ينقل المرشحين المحددين إلى هذا المستوى"
            accessibilityLabel={`المستوى ${TIER_LABELS[tier]}`}
            accessibilityRole="button"
            disabled={board.selected.length === 0}
            key={tier}
            onPress={() => setBoard((current) =>
              moveCandidatesToTier(current, tier, visibleCandidates))}
            style={[
              styles.tierRow,
              {
                borderColor: board.selected.length > 0
                  ? tierColors[tier]
                  : theme.palette.border,
              },
            ]}
          >
            <View style={[styles.tierLabel, { backgroundColor: tierColors[tier] }] }>
              <AppText style={styles.tierLetter} variant="heading">{tier}</AppText>
              <AppText style={styles.tierDescription} variant="caption">
                {TIER_LABELS[tier]}
              </AppText>
            </View>
            <View style={styles.tierCandidates}>
              {board.tiers[tier].length === 0 ? (
                <AppText color="muted" variant="caption">انقر على مرشح ثم انقر هنا لنقله</AppText>
              ) : board.tiers[tier].map((candidateId, index) => {
                const candidate = candidateById.get(candidateId);
                if (!candidate) {
                  return null;
                }
                const selected = board.selected.includes(candidateId);
                return (
                  <View key={candidateId} style={styles.rankedCandidate}>
                    <CandidateButton
                      candidate={candidate}
                      onPress={() => setBoard((current) =>
                        toggleBoardSelection(current, candidateId))}
                      selected={selected}
                    />
                    <View style={styles.orderButtons}>
                      <Pressable
                        accessibilityLabel={`رفع ${candidate.name}`}
                        disabled={index === 0}
                        hitSlop={8}
                        onPress={() => setBoard((current) =>
                          moveCandidateWithinTier(current, tier, candidateId, -1))}
                        style={styles.orderButton}
                      >
                        <AppText color={index === 0 ? 'muted' : 'default'}>↑</AppText>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`خفض ${candidate.name}`}
                        disabled={index === board.tiers[tier].length - 1}
                        hitSlop={8}
                        onPress={() => setBoard((current) =>
                          moveCandidateWithinTier(current, tier, candidateId, 1))}
                        style={styles.orderButton}
                      >
                        <AppText
                          color={
                            index === board.tiers[tier].length - 1
                              ? 'muted'
                              : 'default'
                          }
                        >
                          ↓
                        </AppText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </Pressable>
        ))}
        <AppText color="muted" style={styles.watermark} variant="caption">
          syrian.zone/tierlist
        </AppText>
      </View>

      <AppCard style={styles.bank}>
        <AppText variant="heading">المرشحون</AppText>
        <AppText color="muted" variant="caption">
          اختر مرشحًا أو أكثر ثم انقر على المستوى المناسب في القائمة. انقر على مرشح
          مُرتَّب لتحديده ثم أعده إلى هنا أو انقله إلى مستوى آخر.
        </AppText>
        <View style={styles.bankGrid}>
          {bank.map((candidate) => (
            <CandidateButton
              candidate={candidate}
              key={candidate.id}
              onPress={() => setBoard((current) =>
                toggleBoardSelection(current, candidate.id))}
              selected={board.selected.includes(candidate.id)}
            />
          ))}
        </View>
      </AppCard>

      <AppText color="muted" variant="caption">
        تم ترتيب {assignedCandidateCount(board)} من {visibleCandidates.length}
      </AppText>
      {error ? <AppText color="danger">{error}</AppText> : null}
      {success ? <AppText color="success">{success}</AppText> : null}
      <View style={styles.actions}>
        <AppButton
          icon={<Vote color={theme.palette.primaryForeground} size={18} />}
          loading={busy}
          onPress={() => void submit()}
        >
          تسجيل التصويت
        </AppButton>
        <AppButton
          icon={<Share2 color={theme.palette.foreground} size={18} />}
          loading={sharing}
          onPress={() => void shareBoard()}
          variant="secondary"
        >
          مشاركة القائمة كصورة
        </AppButton>
        {selectedGroup?.key === 'jolani' ? (
          <AppButton
            icon={<Download color={theme.palette.foreground} size={18} />}
            loading={sharing}
            onPress={() => void shareArchive()}
            variant="secondary"
          >
            مشاركة أرشيف الصور
          </AppButton>
        ) : null}
        <AppButton
          icon={<RotateCcw color={theme.palette.foreground} size={18} />}
          onPress={() => {
            setBoard(createEmptyBoard());
            setError(null);
            setSuccess(null);
          }}
          variant="ghost"
        >
          إعادة الترتيب
        </AppButton>
      </View>
    </View>
  );
}

function CandidateButton({
  candidate,
  onPress,
  selected,
}: {
  candidate: PollCandidate;
  onPress: () => void;
  selected: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={`اختيار ${candidate.name}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.candidate,
        {
          backgroundColor: theme.palette.surface,
          borderColor: selected ? theme.palette.primary : theme.palette.border,
        },
      ]}
    >
      <TierAvatar imageUrl={candidate.imageUrl} name={candidate.name} size={42} />
      <AppText numberOfLines={2} style={styles.candidateName} variant="caption">
        {candidate.name}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  bank: {
    gap: 10,
  },
  bankGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkPanel: {
    gap: 10,
  },
  candidate: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    gap: 4,
    minHeight: 82,
    padding: 7,
    width: 82,
  },
  candidateName: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  captureBoard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    gap: 6,
    overflow: 'hidden',
    padding: 8,
  },
  captureTitle: {
    color: '#18211a',
    padding: 6,
    textAlign: 'center',
  },
  container: {
    gap: 14,
  },
  groupTab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  groupTabs: {
    flexWrap: 'wrap',
    gap: 8,
  },
  orderButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 28,
  },
  orderButtons: {
    alignItems: 'center',
    gap: 4,
  },
  rankedCandidate: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 3,
  },
  tierCandidates: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
    minHeight: 84,
    padding: 5,
  },
  tierDescription: {
    color: '#ffffff',
    fontSize: 10,
    textAlign: 'center',
  },
  tierLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    width: 58,
  },
  tierLetter: {
    color: '#ffffff',
    textAlign: 'center',
  },
  tierMove: {
    alignItems: 'center',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tierMoveText: {
    color: '#ffffff',
  },
  tierRow: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    overflow: 'hidden',
  },
  watermark: {
    color: '#64748b',
    padding: 4,
    textAlign: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Components/poll/TierBoard.tsx (888 lines)
  confidence: high
  todos:      0
  notes:      Native multi-select, tappable tier rows, return-to-bank for placed candidates, touch-sized order controls, secure daily voting, and bounded sharing preserve the board workflow.
*/
