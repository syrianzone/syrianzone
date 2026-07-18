import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import {
  ArrowRight,
  Check,
  Gamepad2,
  HelpCircle,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';

import { resolveGuessWhoCharacterImage } from './api';
import type { GuessWhoBoardCharacter, GuessWhoGamePhase } from './model';
import type { GuessWhoBoundSession } from './types';
import {
  type GuessWhoTransportStatus,
  useGuessWhoRoom,
} from './useGuessWhoRoom';

interface GameRoomProps {
  entry: GuessWhoBoundSession;
  onExit: () => void;
  onRestart: () => void;
}

function transportCopy(status: GuessWhoTransportStatus, opponent: string) {
  switch (status) {
    case 'connected':
      return { color: 'success' as const, label: `متصل بـ ${opponent}` };
    case 'connecting':
      return { color: 'primary' as const, label: 'جاري الاتصال بالخصم...' };
    case 'retrying':
      return { color: 'primary' as const, label: 'نعيد محاولة الاتصال...' };
    case 'inactive':
      return { color: 'muted' as const, label: 'الاتصال متوقف في الخلفية' };
    case 'manual':
      return { color: 'danger' as const, label: 'تعذر الاتصال تلقائياً' };
    case 'error':
      return { color: 'danger' as const, label: 'حدث خطأ في الاتصال' };
    case 'waiting':
      return { color: 'muted' as const, label: 'بانتظار انضمام الخصم...' };
  }
}

function StatusPill({
  children,
  color,
}: {
  children: ReactNode;
  color: 'danger' | 'muted' | 'primary' | 'success';
}) {
  const { theme } = useAppTheme();
  const palette = {
    danger: theme.palette.danger,
    muted: theme.palette.mutedForeground,
    primary: theme.palette.primary,
    success: theme.palette.success,
  } as const;
  return (
    <View
      style={[
        styles.pill,
        { borderColor: palette[color], backgroundColor: theme.palette.surfaceRaised },
      ]}
    >
      <AppText color={color} variant="caption">
        {children}
      </AppText>
    </View>
  );
}

function CharacterCard({
  character,
  cardWidth,
  gamePhase,
  myTurn,
  onChooseSecret,
  onGuess,
  onToggleElimination,
}: {
  character: GuessWhoBoardCharacter;
  cardWidth: number;
  gamePhase: GuessWhoGamePhase;
  myTurn: boolean;
  onChooseSecret: (id: number) => void;
  onGuess: (id: number) => void;
  onToggleElimination: (id: number) => void;
}) {
  const { theme } = useAppTheme();
  const [confirming, setConfirming] = useState(false);
  const chooseMode = gamePhase === 'lobby';
  const confirm = () => {
    setConfirming(false);
    if (chooseMode) {
      onChooseSecret(character.id);
    } else {
      onGuess(character.id);
    }
  };

  return (
    <>
      <AppCard
        accessibilityLabel={character.name_ar}
        style={[
          styles.characterCard,
          {
            borderColor: character.eliminated
              ? theme.palette.danger
              : theme.palette.border,
            opacity: character.eliminated ? 0.35 : 1,
            width: cardWidth,
          },
        ]}
      >
        <Image
          accessibilityLabel={character.name_ar}
          contentFit="cover"
          source={{ uri: resolveGuessWhoCharacterImage(character.image_path) }}
          style={[styles.characterImage, { height: cardWidth - 14 }]}
          transition={150}
        />
        <AppText numberOfLines={1} style={styles.characterName} variant="caption">
          {character.name_ar}
        </AppText>
        {chooseMode ? (
          <AppButton onPress={() => setConfirming(true)}>
            اختيار الشخصية
          </AppButton>
        ) : null}
        {gamePhase === 'playing' ? (
          <View style={styles.cardActions}>
            {!character.eliminated ? (
              <AppButton
                disabled={!myTurn}
                onPress={() => setConfirming(true)}
              >
                تخمين الشخصية
              </AppButton>
            ) : null}
            <AppButton
              onPress={() => onToggleElimination(character.id)}
              variant={character.eliminated ? 'secondary' : 'danger'}
            >
              {character.eliminated ? 'إرجاع' : 'استبعاد'}
            </AppButton>
          </View>
        ) : null}
      </AppCard>

      <Modal
        animationType="fade"
        onRequestClose={() => setConfirming(false)}
        transparent
        visible={confirming}
      >
        <Pressable
          accessibilityLabel="إغلاق التأكيد"
          onPress={() => setConfirming(false)}
          style={[styles.modalBackdrop, { backgroundColor: theme.palette.overlay }]}
        >
          <Pressable onPress={() => undefined}>
            <AppCard style={styles.confirmation}>
              <HelpCircle color={theme.palette.primary} size={34} />
              <AppText style={styles.centered} variant="heading">
                {chooseMode
                  ? 'هل تريد اختيار هذه كشخصيتك السرية؟'
                  : `هل أنت متأكد من تخمين: "${character.name_ar}"؟`}
              </AppText>
              <AppButton
                icon={<Check color={theme.palette.primaryForeground} size={18} />}
                onPress={confirm}
              >
                نعم
              </AppButton>
              <AppButton
                icon={<X color={theme.palette.foreground} size={18} />}
                onPress={() => setConfirming(false)}
                variant="secondary"
              >
                إلغاء
              </AppButton>
            </AppCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function GameRoom({ entry, onExit, onRestart }: GameRoomProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const controller = useGuessWhoRoom(entry);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const columns = width >= 900 ? 6 : width >= 600 ? 4 : width >= 390 ? 3 : 2;
  const cardWidth = Math.floor((Math.min(width, 1_100) - 32 - (columns - 1) * 8) / columns);
  const connection = transportCopy(
    controller.transportStatus,
    controller.opponentName,
  );
  const secret = useMemo(
    () =>
      controller.game?.board.find(
        (character) => character.id === controller.game?.my_secret_id,
      ) ?? null,
    [controller.game],
  );
  const myRemaining =
    controller.game?.board.filter((character) => !character.eliminated).length ??
    0;

  const shareRoom = async () => {
    const url = Linking.createURL('/feature/guesswho', {
      queryParams: { room: entry.room_code },
    });
    await Clipboard.setStringAsync(url);
    await Share.share({ message: `انضم إلى غرفة لعبة من هو؟\n${url}` });
    setShareNotice('تم نسخ رابط الغرفة وفتحت قائمة المشاركة.');
  };

  if (controller.loading) {
    return (
      <Screen title="جاري التحقق من الغرفة...">
        <AppCard style={styles.centeredCard}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
          <AppText color="muted">
            نتأكد من توفر مقعدك ونجهز الاتصال المباشر.
          </AppText>
        </AppCard>
      </Screen>
    );
  }

  if (controller.roomError || !controller.snapshot || !controller.game) {
    return (
      <Screen title="تعذر فتح الغرفة">
        <QueryState
          detail={controller.roomError ?? 'أعادت الغرفة بيانات غير مكتملة.'}
          onRetry={controller.retry}
          type="error"
        />
        <AppButton onPress={onExit} variant="secondary">
          العودة إلى قائمة اللعبة
        </AppButton>
      </Screen>
    );
  }

  const game = controller.game;
  const showManualReconnect =
    controller.transportStatus === 'manual' ||
    controller.transportStatus === 'error';

  return (
    <Screen
      subtitle={`الفئة المحددة: ${controller.snapshot.category.name_ar}`}
      title={`غرفة لعب ${entry.room_code}`}
      trailing={<Gamepad2 color={theme.palette.primary} size={28} />}
    >
      <AppCard style={styles.roomHeader}>
        <AppButton
          icon={<ArrowRight color={theme.palette.foreground} size={18} />}
          onPress={onExit}
          variant="ghost"
        >
          العودة
        </AppButton>
        <StatusPill color={connection.color}>{connection.label}</StatusPill>
        <AppButton
          icon={<Share2 color={theme.palette.primaryForeground} size={18} />}
          onPress={() => void shareRoom()}
        >
          مشاركة الغرفة
        </AppButton>
      </AppCard>

      {shareNotice ? (
        <Pressable onPress={() => setShareNotice(null)}>
          <AppCard style={styles.notice}>
            <AppText color="success">{shareNotice}</AppText>
            <X color={theme.palette.mutedForeground} size={18} />
          </AppCard>
        </Pressable>
      ) : null}

      {game.notice ? (
        <Pressable onPress={controller.dismissNotice}>
          <AppCard style={styles.notice}>
            <AppText color="primary">{game.notice}</AppText>
            <X color={theme.palette.mutedForeground} size={18} />
          </AppCard>
        </Pressable>
      ) : null}

      {showManualReconnect ? (
        <AppCard style={styles.reconnectCard}>
          <AppText color="danger" variant="label">
            لم ينجح الاتصال بعد المحاولات التلقائية.
          </AppText>
          <AppButton
            icon={<RefreshCw color={theme.palette.primaryForeground} size={18} />}
            onPress={controller.reconnect}
          >
            إعادة الاتصال
          </AppButton>
        </AppCard>
      ) : null}

      {game.phase === 'selecting' ? (
        <AppCard style={styles.centeredCard}>
          <Gamepad2 color={theme.palette.primary} size={40} />
          <AppText variant="heading">تم اختيار شخصيتك السرية!</AppText>
          <AppText color="muted" style={styles.centered}>
            ننتظر اتصال الخصم واختياره لشخصيته السرية قبل بدء المواجهة.
          </AppText>
          <StatusPill color="primary">بانتظار جاهزية الخصم...</StatusPill>
        </AppCard>
      ) : null}

      {game.phase === 'lobby' ? (
        <>
          <AppCard style={styles.intro}>
            <AppText variant="heading">اختر شخصيتك السرية للبدء</AppText>
            <AppText color="muted">
              سيحاول خصمك معرفة الشخصية التي تختارها. لا تُرسل الشخصية السرية عبر الاتصال.
            </AppText>
            <AppText color="muted">
              تبدأ لوحة اللعب بعد اختيار كلا اللاعبين ووصول قناة البيانات المباشرة.
            </AppText>
          </AppCard>
          <View style={styles.characterGrid}>
            {game.board.map((character) => (
              <CharacterCard
                cardWidth={cardWidth}
                character={character}
                gamePhase={game.phase}
                key={character.id}
                myTurn={game.my_turn}
                onChooseSecret={controller.chooseSecret}
                onGuess={controller.guess}
                onToggleElimination={controller.toggleElimination}
              />
            ))}
          </View>
        </>
      ) : null}

      {game.phase === 'playing' ? (
        <>
          <AppCard style={styles.dashboard}>
            <View style={styles.secretSummary}>
              {secret ? (
                <Image
                  accessibilityLabel={secret.name_ar}
                  contentFit="cover"
                  source={{ uri: resolveGuessWhoCharacterImage(secret.image_path) }}
                  style={styles.secretImage}
                />
              ) : null}
              <View style={styles.grow}>
                <AppText color="muted" variant="caption">
                  شخصيتك السرية
                </AppText>
                <AppText variant="label">{secret?.name_ar ?? 'غير محددة'}</AppText>
              </View>
            </View>
            <View style={styles.counts}>
              <StatusPill color="primary">شخصياتك: {myRemaining}</StatusPill>
              <StatusPill color="muted">
                الخصم: {game.opponent_remaining}
              </StatusPill>
            </View>
            <StatusPill color={game.my_turn ? 'primary' : 'muted'}>
              {game.my_turn
                ? 'دورك لطرح الأسئلة والتخمين'
                : 'انتظر دور الخصم...'}
            </StatusPill>
            <AppButton disabled={!game.my_turn} onPress={controller.passTurn}>
              إنهاء دوري وتمريره للخصم
            </AppButton>
          </AppCard>
          <AppCard style={styles.helpRow}>
            <HelpCircle color={theme.palette.primary} size={18} />
            <AppText color="muted" style={styles.grow} variant="caption">
              استبعد الشخصيات بناءً على الإجابات. لا يمكنك إرسال تخمين إلا في دورك.
            </AppText>
          </AppCard>
          <View style={styles.characterGrid}>
            {game.board.map((character) => (
              <CharacterCard
                cardWidth={cardWidth}
                character={character}
                gamePhase={game.phase}
                key={character.id}
                myTurn={game.my_turn}
                onChooseSecret={controller.chooseSecret}
                onGuess={controller.guess}
                onToggleElimination={controller.toggleElimination}
              />
            ))}
          </View>
        </>
      ) : null}

      {game.phase === 'ended' ? (
        <AppCard style={styles.endedCard}>
          <Gamepad2 color={theme.palette.primary} size={44} />
          <AppText variant="title">انتهت اللعبة!</AppText>
          <AppText color="primary" style={styles.centered} variant="heading">
            {game.terminal_message ?? 'انتهت هذه المواجهة.'}
          </AppText>
          <AppButton
            icon={<RefreshCw color={theme.palette.primaryForeground} size={18} />}
            onPress={onRestart}
          >
            العب مجدداً
          </AppButton>
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardActions: { gap: 6 },
  centered: { textAlign: 'center' },
  centeredCard: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  characterCard: { gap: 7, padding: 6 },
  characterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  characterImage: { borderRadius: 12, width: '100%' },
  characterName: { textAlign: 'center' },
  confirmation: { gap: 14, marginHorizontal: 24, maxWidth: 420, padding: 24 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dashboard: { gap: 12 },
  endedCard: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  grow: { flex: 1 },
  helpRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  intro: { gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center' },
  notice: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  reconnectCard: { gap: 10 },
  roomHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secretImage: { borderRadius: 10, height: 52, width: 52 },
  secretSummary: { alignItems: 'center', flexDirection: 'row', gap: 10 },
});

/*
PORT STATUS
  source:     resources/js/Pages/GuessWho/Room.tsx (864 lines)
  confidence: high
  todos:      0
  notes:      Native room play preserves presence, private selection, turns, guesses, reconnects, terminal states, and cleanup.
*/
