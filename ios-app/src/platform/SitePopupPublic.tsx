import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Keyboard, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { api } from '../api';
import { Label, Section } from '../components';
import { NativeAction, NativeIconAction } from '../ui/native';
import { useTheme } from '../ui/theme';
import { openExternal } from './links';
import { readDocument, writeDocument } from './storage';
import { record } from './validation';
import { createPopupSession, decodePopupDismissals, decodePublicPopup, type PublicPopup } from './site-popup-model';
import flag from './site-popup-flag.json';

const DISMISSALS = 'site-popup-dismissals.v1';
type PopupSession = ReturnType<typeof createPopupSession>;

export function SitePopupPublic({
  pageKey,
  suppressed = false,
  interactionVersion = 0
}: {
  pageKey: string;
  suppressed?: boolean;
  interactionVersion?: number;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [popup, setPopup] = useState<PublicPopup | null>(null),
    [dismissals, setDismissals] = useState<number[] | null>(null),
    [visible, setVisible] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null),
    [networkError, setNetworkError] = useState<string | null>(null),
    [actionError, setActionError] = useState<string | null>(null);
  const error = storageError ?? networkError ?? actionError;
  const [revision, setRevision] = useState(0),
    [pending, setPending] = useState<PopupSession | null>(null);
  const session = useRef<PopupSession | null>(null),
    alive = useRef(true),
    writes = useRef(Promise.resolve());
  const interaction = useRef({ pageKey, version: interactionVersion });
  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener('change', (value) => setActive(value === 'active'));
    return () => {
      alive.current = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    let current = true;
    void readDocument(DISMISSALS, decodePopupDismissals, [])
      .then((value) => {
        if (current) {
          setDismissals(value);
          setStorageError(null);
        }
      })
      .catch(() => {
        if (current) setStorageError('تعذّر قراءة التنبيهات المغلقة. أعد المحاولة.');
      });
    return () => {
      current = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!active || suppressed) return;
    const controller = new AbortController();
    void api
      .page('/', 'Home', (value) => decodePublicPopup(record(value).sitePopup), { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setPopup(value);
          setNetworkError(null);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setNetworkError(reason instanceof Error ? reason.message : 'تعذّر قراءة تنبيه الموقع.');
      });
    return () => controller.abort();
  }, [active, suppressed, pageKey, revision]);
  const persist = useCallback((version: number): Promise<void> => {
    const next = writes.current
      .catch(() => {})
      .then(async () => {
        const current = await readDocument(DISMISSALS, decodePopupDismissals, []),
          updated = [...new Set([...current, version])];
        await writeDocument(DISMISSALS, updated);
        if (alive.current) setDismissals(updated);
      });
    writes.current = next;
    return next;
  }, []);
  const version = popup?.version,
    dismissed = version !== undefined && (dismissals?.includes(version) ?? false),
    storageReady = dismissals !== null;
  useEffect(() => {
    setVisible(false);
    if (version === undefined || !storageReady) return;
    const current = createPopupSession(version, dismissed, {
      persist,
      show: setVisible,
      schedule: (task, delay) => {
        const timer = setTimeout(task, delay);
        return () => clearTimeout(timer);
      }
    });
    session.current = current;
    return () => {
      current.dispose();
      if (session.current === current) session.current = null;
    };
  }, [version, dismissed, storageReady, pageKey, persist]);
  useEffect(() => {
    session.current?.setEligible(active && !suppressed && popup?.enabled === true);
  }, [active, suppressed, popup?.enabled, version, dismissed, storageReady, pageKey]);
  useEffect(() => {
    const previous = interaction.current;
    interaction.current = { pageKey, version: interactionVersion };
    if (previous.pageKey === pageKey && previous.version !== interactionVersion) session.current?.quiet();
  }, [pageKey, interactionVersion]);
  useEffect(() => {
    const listener = Keyboard.addListener('keyboardWillShow', () => session.current?.quiet());
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (visible && popup) AccessibilityInfo.announceForAccessibility(`${popup.title}. ${popup.description}`);
  }, [visible, popup]);
  const dismiss = async () => {
    const current = session.current;
    if (!current || pending === current) return;
    setPending(current);
    setActionError(null);
    try {
      await current.dismiss();
    } catch {
      if (alive.current && session.current === current) setActionError('تعذّر حفظ إغلاق التنبيه. حاول مجدداً.');
    } finally {
      if (alive.current) setPending((previous) => (previous === current ? null : previous));
    }
  };
  if (suppressed || !active) return null;
  if (error && !visible)
    return (
      <PopupSurface>
        <Section>
          <Label secondary>{error}</Label>
          <NativeAction
            title="إعادة قراءة تنبيه الموقع"
            onPress={() => {
              setStorageError(null);
              setNetworkError(null);
              setActionError(null);
              setRevision((value) => value + 1);
            }}
          />
        </Section>
      </PopupSurface>
    );
  if (!visible || !popup?.enabled) return null;
  const busy = pending === session.current;
  return (
    <PopupSurface>
      <Section style={{ borderWidth: 1, borderColor: colors.accent, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SvgXml xml={flag.xml} width={28} height={28} accessible={false} />
          <View style={{ flex: 1 }}>
            <Label style={{ fontWeight: '700' }}>{popup.title}</Label>
          </View>
          <NativeIconAction title="إغلاق إشعار الموقع" systemImage="xmark" disabled={busy} onPress={() => void dismiss()} />
        </View>
        <Pressable testID="إخفاء التنبيه لهذه الزيارة" accessibilityRole="button" accessibilityLabel={`${popup.description}، إخفاء التنبيه لهذه الزيارة`} onPress={() => session.current?.quiet()}>
          <Label>{popup.description}</Label>
        </Pressable>
        {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <NativeAction
            title={popup.buttonText}
            systemImage="arrow.up.forward"
            prominent
            disabled={busy}
            style={{ flexGrow: 1, flexBasis: 140 }}
            onPress={() => {
              void openExternal(popup.link).catch(() => {
                if (alive.current) setActionError('تعذّر فتح رابط التنبيه.');
              });
            }}
          />
          <NativeAction title={popup.dismissText} disabled={busy} style={{ flexGrow: 1, flexBasis: 140 }} onPress={() => void dismiss()} />
        </View>
      </Section>
    </PopupSurface>
  );
}
function PopupSurface({ children }: { children: ReactNode }): React.JSX.Element {
  const { height } = useWindowDimensions(),
    { colors } = useTheme(),
    maxHeight = Math.min(320, height * 0.4);
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ position: 'absolute', bottom: 0, start: 0, end: 0, zIndex: 1, maxHeight, backgroundColor: colors.background }}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <ScrollView style={{ maxHeight, flexGrow: 0 }} contentContainerStyle={{ padding: 12 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
// PORT STATUS: source ConditionalLayout.tsx and UnblockSyriaNotification.tsx; confidence medium; todos 1 global native placement and interaction verification.
