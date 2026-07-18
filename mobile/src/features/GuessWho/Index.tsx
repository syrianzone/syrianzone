import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Gamepad2,
  HelpCircle,
  Layers,
  Play,
  Plus,
  ShieldAlert,
  Tv,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { ApiError } from '@/lib/api/errors';
import { roomSessionStorage } from '@/lib/storage/secure';

import { guessWhoApi } from './api';
import GameRoom from './Room';
import {
  boundSessionIsUsable,
  loadBoundSession,
  normalizeRoomCode,
  readStoredBoundSession,
  saveBoundSession,
  validRoomCode,
} from './session';
import type {
  GuessWhoBoundSession,
  GuessWhoCategory,
  GuessWhoCategorySelection,
} from './types';

type LobbyTab = 'create' | 'join';

function CategoryCard({
  category,
  onSelect,
  selected,
}: {
  category: GuessWhoCategory;
  onSelect: () => void;
  selected: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <AppCard
        style={[
          styles.category,
          { borderColor: selected ? theme.palette.primary : theme.palette.border },
        ]}
      >
        <View style={styles.categoryTitle}>
          <Tv
            color={
              selected ? theme.palette.primary : theme.palette.mutedForeground
            }
            size={20}
          />
          <AppText variant="label">{category.name_ar}</AppText>
        </View>
        <AppText color="muted" variant="caption">
          لعب ببطاقات الفئة المخصصة
        </AppText>
        <AppText color={selected ? 'primary' : 'muted'} variant="caption">
          {category.characters_count.toLocaleString('ar-SY')} شخصية
        </AppText>
      </AppCard>
    </Pressable>
  );
}

function GuideCard({ children, index, title }: { children: string; index: string; title: string }) {
  const { theme } = useAppTheme();
  return (
    <AppCard style={styles.guideCard}>
      <View
        style={[
          styles.step,
          { backgroundColor: theme.palette.surfaceRaised, borderColor: theme.palette.primary },
        ]}
      >
        <AppText color="primary" variant="heading">{index}</AppText>
      </View>
      <AppText variant="label">{title}</AppText>
      <AppText color="muted" style={styles.centered} variant="caption">
        {children}
      </AppText>
    </AppCard>
  );
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function GuessWhoIndex() {
  const { theme } = useAppTheme();
  const params = useLocalSearchParams<{ room?: string | string[] }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LobbyTab>('create');
  const [selectedCategory, setSelectedCategory] =
    useState<GuessWhoCategorySelection | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<GuessWhoBoundSession | null>(null);
  const [roomRun, setRoomRun] = useState(0);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledDeepLink = useRef<string | null>(null);
  const categoriesQuery = useQuery({
    queryFn: ({ signal }) => guessWhoApi.getCategories(signal),
    queryKey: ['guess-who-categories'],
    staleTime: 10 * 60 * 1000,
  });

  const enterRoom = useCallback(async (rawCode: string) => {
    const roomCode = normalizeRoomCode(rawCode);
    if (!validRoomCode(roomCode)) {
      setErrorMessage('أدخل رمز غرفة صالحاً يتكون من أحرف أو أرقام.');
      return;
    }
    setPending(true);
    setErrorMessage(null);
    try {
      const previous = await readStoredBoundSession();
      if (
        previous?.room_code === roomCode &&
        !boundSessionIsUsable(previous, roomCode)
      ) {
        await roomSessionStorage.clear();
        throw new ApiError(
          401,
          'expired_bound_room',
          'انتهت جلسة هذه الغرفة. أنشئ غرفة جديدة للعب مرة أخرى.',
        );
      }
      const stored = await loadBoundSession(roomCode);
      if (stored) {
        try {
          await guessWhoApi.getRoom(roomCode, stored.credential);
          setActiveRoom(stored);
          return;
        } catch (error) {
          await roomSessionStorage.clear();
          throw error;
        }
      }
      const credential = await guessWhoApi.issueSession();
      const joined = await guessWhoApi.joinRoom(roomCode, credential);
      await saveBoundSession(joined);
      setActiveRoom(joined);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError && error.code === 'room_full'
          ? 'هذه الغرفة ممتلئة بالكامل ولا يمكنك الانضمام إليها.'
          : error instanceof ApiError &&
              ['expired_bound_room', 'invalid_room_session'].includes(error.code)
            ? 'انتهت جلسة هذه الغرفة. أنشئ غرفة جديدة للعب مرة أخرى.'
            : 'تعذر الانضمام إلى الغرفة. تحقق من الرمز وحاول مجدداً.',
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    const linkedRoom = normalizeRoomCode(readParam(params.room));
    if (!linkedRoom || linkedRoom === handledDeepLink.current || activeRoom) {
      return;
    }
    handledDeepLink.current = linkedRoom;
    void enterRoom(linkedRoom);
  }, [activeRoom, enterRoom, params.room]);

  const createRoom = async () => {
    if (!selectedCategory) {
      return;
    }
    setPending(true);
    setErrorMessage(null);
    try {
      const credential = await guessWhoApi.issueSession();
      const created = await guessWhoApi.createRoom(
        selectedCategory,
        credential,
      );
      await saveBoundSession(created);
      setActiveRoom(created);
    } catch {
      setErrorMessage('تعذر إنشاء الغرفة. حاول مرة أخرى.');
    } finally {
      setPending(false);
    }
  };

  const exitRoom = () => {
    handledDeepLink.current = activeRoom?.room_code ?? null;
    setActiveRoom(null);
    router.setParams({ room: undefined });
  };

  if (activeRoom) {
    return (
      <GameRoom
        entry={activeRoom}
        key={`${activeRoom.room_code}:${roomRun}`}
        onExit={exitRoom}
        onRestart={() => setRoomRun((value) => value + 1)}
      />
    );
  }

  const categories = categoriesQuery.data?.categories ?? [];
  const totalCharacters = categoriesQuery.data?.total_characters ?? 0;

  return (
    <Screen
      subtitle="تحدّ صديقك بالاتصال المباشر، واستبعد الشخصيات حتى تكشف بطاقته السرية."
      title="لعبة مَنْ هُوَ؟"
      trailing={<Gamepad2 color={theme.palette.primary} size={38} />}
    >
      {errorMessage ? (
        <Pressable onPress={() => setErrorMessage(null)}>
          <AppCard style={styles.errorCard}>
            <ShieldAlert color={theme.palette.danger} size={22} />
            <AppText color="danger" style={styles.grow}>{errorMessage}</AppText>
            <X color={theme.palette.danger} size={18} />
          </AppCard>
        </Pressable>
      ) : null}

      <AppCard style={styles.menu}>
        <View style={styles.tabs}>
          <AppButton
            icon={<Plus color={activeTab === 'create' ? theme.palette.primaryForeground : theme.palette.foreground} size={18} />}
            onPress={() => setActiveTab('create')}
            variant={activeTab === 'create' ? 'primary' : 'secondary'}
          >
            إنشاء تحدٍّ جديد
          </AppButton>
          <AppButton
            icon={<Play color={activeTab === 'join' ? theme.palette.primaryForeground : theme.palette.foreground} size={18} />}
            onPress={() => setActiveTab('join')}
            variant={activeTab === 'join' ? 'primary' : 'secondary'}
          >
            انضمام لغرفة قائمة
          </AppButton>
        </View>

        {activeTab === 'create' ? (
          <View style={styles.form}>
            <AppText variant="heading">اختر فئة الشخصيات</AppText>
            <AppText color="muted" variant="caption">
              يسحب الخادم حتى ٢٤ شخصية متطابقة لك ولخصمك.
            </AppText>
            {categoriesQuery.isPending ? (
              <AppCard style={styles.loadingCard}>
                <ActivityIndicator color={theme.palette.primary} size="large" />
                <AppText color="muted">جاري تحميل فئات اللعبة...</AppText>
              </AppCard>
            ) : null}
            {categoriesQuery.isError ? (
              <QueryState
                detail="تعذر تحميل فئات اللعبة."
                onRetry={() => void categoriesQuery.refetch()}
                type="error"
              />
            ) : null}
            {totalCharacters >= 12 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedCategory('random')}
              >
                <AppCard
                  style={[
                    styles.randomCategory,
                    {
                      borderColor:
                        selectedCategory === 'random'
                          ? theme.palette.primary
                          : theme.palette.border,
                    },
                  ]}
                >
                  <Layers
                    color={
                      selectedCategory === 'random'
                        ? theme.palette.primary
                        : theme.palette.mutedForeground
                    }
                    size={22}
                  />
                  <View style={styles.grow}>
                    <AppText variant="label">عشوائي من كل الفئات</AppText>
                    <AppText color="muted" variant="caption">
                      خليط عشوائي من {totalCharacters.toLocaleString('ar-SY')} شخصية متاحة
                    </AppText>
                  </View>
                </AppCard>
              </Pressable>
            ) : null}
            <View style={styles.categories}>
              {categories.map((category) => (
                <CategoryCard
                  category={category}
                  key={category.id}
                  onSelect={() => setSelectedCategory(category.id)}
                  selected={selectedCategory === category.id}
                />
              ))}
            </View>
            {!categoriesQuery.isPending && !categoriesQuery.isError && categories.length === 0 ? (
              <QueryState detail="لا توجد فئات متاحة حالياً." type="empty" />
            ) : null}
            <AppButton
              disabled={!selectedCategory}
              loading={pending}
              onPress={() => void createRoom()}
            >
              أنشئ غرفة اللعب الآن
            </AppButton>
          </View>
        ) : (
          <View style={styles.form}>
            <AppText style={styles.centered} variant="heading">انضم إلى صديقك</AppText>
            <AppText color="muted" style={styles.centered} variant="caption">
              أدخل رمز الغرفة الذي شاركه صديقك معك.
            </AppText>
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setRoomCodeInput}
              placeholder="أدخل رمز الغرفة هنا"
              value={roomCodeInput}
            />
            <AppButton
              disabled={!validRoomCode(roomCodeInput)}
              loading={pending}
              onPress={() => void enterRoom(roomCodeInput)}
            >
              انضم للعب فوراً
            </AppButton>
          </View>
        )}
      </AppCard>

      <View style={styles.guideTitle}>
        <HelpCircle color={theme.palette.primary} size={24} />
        <AppText variant="heading">كيف تلعب لعبة من هو؟</AppText>
      </View>
      <View style={styles.guides}>
        <GuideCard index="١" title="اختر بطلاً سرياً">
          يختار كل لاعب بطاقة سرية. هدف الخصم هو معرفة بطلك، والعكس صحيح.
        </GuideCard>
        <GuideCard index="٢" title="اطرح أسئلة ذكية">
          تبادل أسئلة نعم أو لا، ثم استبعد الشخصيات بناءً على الإجابة.
        </GuideCard>
        <GuideCard index="٣" title="خَمِّن البطل لتفوز">
          استخدم زر تخمين الشخصية في دورك. التخمين الصحيح ينهي المواجهة مباشرة.
        </GuideCard>
      </View>
      <AppCard style={styles.connectionNote}>
        <ShieldAlert color={theme.palette.primary} size={20} />
        <AppText color="muted" style={styles.grow} variant="caption">
          تنقل WebRTC بيانات اللعبة مباشرة بين الجهازين. لا تطلب اللعبة إذن الكاميرا أو الميكروفون، ويمكنك استخدام مكالمة خارجية لطرح الأسئلة.
        </AppText>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  categories: { gap: 8 },
  category: { gap: 7 },
  categoryTitle: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  centered: { textAlign: 'center' },
  connectionNote: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  errorCard: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  form: { gap: 12 },
  grow: { flex: 1 },
  guideCard: { alignItems: 'center', flex: 1, gap: 8, minWidth: 190 },
  guides: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  guideTitle: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  loadingCard: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  menu: { gap: 16 },
  randomCategory: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  step: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  tabs: { gap: 8 },
});

/*
PORT STATUS
  source:     resources/js/Pages/GuessWho/Index.tsx (283 lines)
  confidence: high
  todos:      0
  notes:      Native lobby preserves category selection, random rooms, secure create and join, deep links, and game guidance.
*/
