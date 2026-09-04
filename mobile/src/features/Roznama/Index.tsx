import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Cloud,
  CloudRain,
  CloudLightning,
  ExternalLink,
  Info,
  MapPin,
  Moon,
  MoonStar,
  Snowflake,
  Sparkles,
  Sun,
  SunDim,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import {
  F3aliaEventsView,
  useF3aliaEvents,
} from '@/components/F3aliaEvents';
import {
  eventDetailUrl,
  provinceLabel,
  todayDateString,
  type F3aliaEvent,
} from '@/components/F3aliaEvents.model';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { formatDuration, governorates } from '@/lib/ported/home';
import { openSafeExternalUrl } from '@/lib/linking';
import {
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

import {
  loadRoznamaPrayerSchedule,
  loadRoznamaWeather,
} from './data';
import {
  buildSyrianHolidays,
  filterPassedHolidays,
  findNextHoliday,
  getActiveAndNextPrayer,
  getWeatherPresentation,
  getWidgetQueryPresentation,
  parseLocalDate,
  type PrayerEventKey,
  type SyrianHoliday,
  type WeatherIconFamily,
} from './model';

const GOVERNORATE_PREFERENCE = 'sz-roznama-governorate';
const HIDE_PASSED_PREFERENCE = 'sz-hide-passed-holidays';
const DECREE_URL = 'https://sana.sy/presidency/2299819/';
const F3ALIA_URL = 'https://app.f3alia.com';

function systemNow(): Date {
  return new Date();
}

// The web page pins this screen to dir="rtl" no matter the site language, and the
// copy here is Arabic-only. AppText otherwise takes its alignment from the app
// locale, which left-aligns every Arabic line once the app is switched to English.
function RoznamaText({ style, ...props }: ComponentProps<typeof AppText>) {
  return <AppText {...props} style={[styles.arabicText, style]} />;
}

export default function RoznamaIndex({
  liveClock = true,
  now = systemNow,
}: {
  liveClock?: boolean;
  now?: () => Date;
}) {
  const { theme } = useAppTheme();
  const [governorate, setGovernorate] = useState('damascus');
  const [currentTime, setCurrentTime] = useState(now);
  const [hidePassed, setHidePassed] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      readStringPreference(GOVERNORATE_PREFERENCE),
      readStringPreference(HIDE_PASSED_PREFERENCE),
    ]).then(([storedGovernorate, storedHidePassed]) => {
      if (!active) {
        return;
      }
      if (governorates.some((item) => item.id === storedGovernorate)) {
        setGovernorate(storedGovernorate ?? 'damascus');
      }
      setHidePassed(storedHidePassed === 'true');
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!liveClock) {
      return;
    }
    const timer = setInterval(() => setCurrentTime(now()), 1000);
    return () => clearInterval(timer);
  }, [liveClock, now]);

  const dayKey = todayDateString(currentTime);
  const calendarDay = useMemo(
    () => parseLocalDate(dayKey) ?? new Date(),
    [dayKey],
  );
  const currentYear = calendarDay.getFullYear();
  const weatherQuery = useQuery({
    enabled: hydrated,
    queryFn: ({ signal }) => loadRoznamaWeather(governorate, signal),
    queryKey: ['roznama-weather', governorate],
  });
  const prayerQuery = useQuery({
    enabled: hydrated,
    queryFn: ({ signal }) =>
      loadRoznamaPrayerSchedule(governorate, currentTime, signal),
    queryKey: ['roznama-prayer', governorate, dayKey],
  });
  const eventsState = useF3aliaEvents({
    allProvinces: showAllEvents,
    enabled: hydrated,
    fallbackToAll: false,
    governorate,
    size: 15,
    today: dayKey,
    variant: 'grid',
  });

  const holidays = useMemo(
    () => buildSyrianHolidays(currentYear),
    [currentYear],
  );
  const nextHoliday = useMemo(
    () => findNextHoliday(calendarDay),
    [calendarDay],
  );
  const visibleHolidays = useMemo(
    () => filterPassedHolidays(holidays, calendarDay, hidePassed),
    [calendarDay, hidePassed, holidays],
  );
  const activePrayer = useMemo(
    () =>
      prayerQuery.data
        ? getActiveAndNextPrayer(prayerQuery.data.value.timings, currentTime)
        : null,
    [currentTime, prayerQuery.data],
  );
  const nextEvent = eventsState.data?.events[0];
  const activeGovernorate =
    governorates.find((item) => item.id === governorate) ?? governorates[0];
  // /api/prayer-times returns hijri: null when upstream omits it, so an empty
  // string has to fall through to the local calendar the same way a missing
  // response does.
  const hijriDate =
    prayerQuery.data?.value.hijriDate.trim() ||
    formatHijriFallback(currentTime);

  const changeGovernorate = (value: string) => {
    setGovernorate(value);
    void writeStringPreference(GOVERNORATE_PREFERENCE, value).catch(
      () => undefined,
    );
  };
  const changeHidePassed = (value: boolean) => {
    setHidePassed(value);
    void writeStringPreference(HIDE_PASSED_PREFERENCE, String(value)).catch(
      () => undefined,
    );
  };
  const refresh = () => {
    void weatherQuery.refetch();
    void prayerQuery.refetch();
    eventsState.retry();
  };
  const refreshing =
    weatherQuery.isRefetching || prayerQuery.isRefetching || eventsState.refreshing;

  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      subtitle="التوقيت المحلي، ومواقيت الصلاة الرسمية، والأعياد والعطل الرسمية للدولة السورية."
      title="الروزنامة"
      trailing={<CalendarDays color={theme.palette.primary} size={28} />}
    >
      <View style={styles.screen} testID="roznama-screen">
        {!hydrated ? (
          <View style={styles.loadingPage}>
            <ActivityIndicator color={theme.palette.primary} size="large" />
          </View>
        ) : (
          <>
            <AppCard style={styles.governorateCard}>
              <View style={styles.sectionTitleRow}>
                <MapPin color={theme.palette.primary} size={18} />
                <RoznamaText variant="label">المحافظة:</RoznamaText>
              </View>
              <View style={styles.chips}>
                {governorates.map((item) => {
                  const selected = item.id === governorate;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={item.id}
                      onPress={() => changeGovernorate(item.id)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: selected
                            ? theme.palette.primary
                            : theme.palette.surfaceRaised,
                          borderColor: selected
                            ? theme.palette.primary
                            : theme.palette.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      testID={`roznama-governorate-${item.id}`}
                    >
                      <RoznamaText
                        style={{
                          color: selected
                            ? theme.palette.primaryForeground
                            : theme.palette.foreground,
                        }}
                        variant="caption"
                      >
                        {item.ar}
                      </RoznamaText>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard style={styles.clockCard}>
              <RoznamaText style={styles.clock}>{formatClock(currentTime)}</RoznamaText>
              <RoznamaText variant="label">{formatGregorianDate(currentTime)}</RoznamaText>
              <RoznamaText color="primary" variant="caption">
                {hijriDate}
              </RoznamaText>
              <WeatherWidget
                activeGovernorate={activeGovernorate?.ar ?? 'دمشق'}
                query={weatherQuery}
              />
            </AppCard>

            <UpcomingHolidayCard
              holiday={nextHoliday}
              nextEvent={nextEvent}
            />

            <PrayerCard
              activeGovernorate={activeGovernorate?.ar ?? 'دمشق'}
              activePrayer={activePrayer}
              query={prayerQuery}
            />

            <AppCard style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.sectionTitleRow}>
                  <Calendar color={theme.palette.primary} size={20} />
                  <RoznamaText variant="heading">
                    العطل الرسمية في سوريا ({currentYear}م)
                  </RoznamaText>
                </View>
                <View style={styles.switchRow}>
                  <Switch
                    onValueChange={changeHidePassed}
                    testID="roznama-hide-passed"
                    thumbColor={theme.palette.primaryForeground}
                    trackColor={{
                      false: theme.palette.border,
                      true: theme.palette.primary,
                    }}
                    value={hidePassed}
                  />
                  <RoznamaText variant="caption">إخفاء العطل المنقضية</RoznamaText>
                </View>
              </View>

              {visibleHolidays.length > 0 ? (
                visibleHolidays.map((holiday) => (
                  <HolidayRow
                    currentTime={calendarDay}
                    holiday={holiday}
                    key={holiday.id}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Calendar color={theme.palette.mutedForeground} size={32} />
                  <RoznamaText color="muted">
                    لا توجد عطلات رسمية متبقية لهذا العام.
                  </RoznamaText>
                </View>
              )}

              <View style={styles.sourceRow}>
                <RoznamaText color="muted" style={styles.shrink} variant="caption">
                  المصدر: المرسوم رقم 188 لعام 2025
                </RoznamaText>
                <SourceLink label="عرض المرسوم في المصدر" url={DECREE_URL} />
              </View>
            </AppCard>

            <AppCard style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.sectionTitleRow}>
                  <Sparkles color={theme.palette.primary} size={20} />
                  <RoznamaText variant="heading">
                    {showAllEvents
                      ? 'الفعاليات القادمة في باقي المحافظات'
                      : `الفعاليات القادمة في ${activeGovernorate?.ar ?? 'دمشق'}`}
                  </RoznamaText>
                </View>
                <View style={styles.switchRow}>
                  <Switch
                    onValueChange={setShowAllEvents}
                    testID="roznama-show-all-events"
                    thumbColor={theme.palette.primaryForeground}
                    trackColor={{
                      false: theme.palette.border,
                      true: theme.palette.primary,
                    }}
                    value={showAllEvents}
                  />
                  <RoznamaText variant="caption">باقي المحافظات</RoznamaText>
                </View>
              </View>
              <F3aliaEventsView
                governorate={governorate}
                language="ar"
                showHeader={false}
                state={eventsState}
                variant="grid"
              />

              {!showAllEvents &&
              !eventsState.loading &&
              eventsState.data?.events.length === 0 ? (
                <AppButton
                  onPress={() => setShowAllEvents(true)}
                  testID="roznama-browse-all-events"
                  variant="ghost"
                >
                  تصفح الفعاليات في باقي المحافظات
                </AppButton>
              ) : null}

              <View style={styles.sourceRow}>
                <RoznamaText color="muted" style={styles.shrink} variant="caption">
                  المصدر: منصة فعالية (F3alia) للأحداث والفعاليات
                </RoznamaText>
                <SourceLink label="عرض المزيد في المصدر" url={F3ALIA_URL} />
              </View>
            </AppCard>

            <AppCard style={styles.notesCard}>
              <Info color={theme.palette.primary} size={22} />
              <View style={styles.notesCopy}>
                <RoznamaText variant="label">
                  ملاحظات حول تعديلات العطل الرسمية (المرسوم 188 لعام 2025):
                </RoznamaText>
                <RoznamaText color="muted" variant="caption">
                  أعاد المرسوم تنظيم التقويم الوطني بإدراج أعياد جديدة (عيد الثورة السورية 18 آذار، وعيد التحرير الوطني 8 كانون الأول تخليداً لسقوط الاستبداد في 8 ديسمبر 2024). وفي المقابل، أُلغيت رسمياً عطل النظام البائد السابقة (انقلاب 8 آذار، ذكرى حرب تشرين 6 تشرين الأول، عيد الشهداء 6 أيار، وعطلة عيد المعلم كعطلة عامة للدولة) لتأسيس روزنامة وطنية جامعة بعيدة عن رموز عهد الاستبداد.
                </RoznamaText>
                <SourceLink
                  label="تصفح نص المرسوم رقم 188 على الرئاسة العامة لوكالة سانا"
                  url={DECREE_URL}
                />
              </View>
            </AppCard>
          </>
        )}
      </View>
    </Screen>
  );
}

function WeatherWidget({
  activeGovernorate,
  query,
}: {
  activeGovernorate: string;
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof loadRoznamaWeather>>>>;
}) {
  const { theme } = useAppTheme();
  const state = getWidgetQueryPresentation({
    fetchStatus: query.fetchStatus,
    hasData: Boolean(query.data),
    isError: query.isError,
    isPending: query.isPending,
  });
  if (state.loading) {
    return (
      <View style={styles.widgetState}>
        <ActivityIndicator color={theme.palette.primary} size="small" />
        <RoznamaText color="muted" variant="caption">جاري تحميل الطقس...</RoznamaText>
      </View>
    );
  }
  if (state.error || !query.data) {
    return (
      <View style={styles.widgetState}>
        <AlertCircle color={theme.palette.danger} size={20} />
        <RoznamaText color="danger" variant="caption">تعذر تحميل الطقس.</RoznamaText>
        <AppButton onPress={() => void query.refetch()} variant="ghost">
          إعادة المحاولة
        </AppButton>
      </View>
    );
  }
  const weather = getWeatherPresentation(
    query.data.value.description,
    query.data.value.icon,
  );
  return (
    <View style={styles.weatherWrap}>
      <View style={styles.weatherRow}>
        <WeatherIcon family={weather.icon} />
        <View style={styles.weatherCopy}>
          <RoznamaText variant="label">{query.data.value.temperature}°C</RoznamaText>
          <RoznamaText color="muted" variant="caption">
            {weather.descriptionAr}
          </RoznamaText>
        </View>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: theme.palette.surfaceRaised,
              borderColor: theme.palette.border,
            },
          ]}
        >
          <RoznamaText variant="caption">الطقس في {activeGovernorate}</RoznamaText>
        </View>
      </View>
      {query.data.cached || state.cached ? (
        <RoznamaText color="muted" variant="caption">
          يتم عرض آخر بيانات الطقس المحفوظة.
        </RoznamaText>
      ) : null}
    </View>
  );
}

function WeatherIcon({ family }: { family: WeatherIconFamily }) {
  const { theme } = useAppTheme();
  const props = { color: theme.palette.primary, size: 27 };
  if (family === 'cloud') {
    return <Cloud {...props} />;
  }
  if (family === 'rain') {
    return <CloudRain {...props} />;
  }
  if (family === 'storm') {
    return <CloudLightning {...props} />;
  }
  if (family === 'snow') {
    return <Snowflake {...props} />;
  }
  if (family === 'wind') {
    return <Wind {...props} />;
  }
  return <Sun {...props} />;
}

function UpcomingHolidayCard({
  holiday,
  nextEvent,
}: {
  holiday: ReturnType<typeof findNextHoliday>;
  nextEvent: F3aliaEvent | undefined;
}) {
  const { theme } = useAppTheme();
  const onPrimary = {
    color: theme.palette.primaryForeground,
    textAlign: 'center' as const,
  };
  return (
    <AppCard style={styles.upcomingCard}>
      <RoznamaText color="primary" variant="caption">المناسبة القادمة</RoznamaText>
      <View style={styles.upcomingRow}>
        <View style={styles.upcomingCopy}>
          <View style={styles.sectionTitleRow}>
            {holiday.isNew ? <SmallBadge label="جديد" success /> : null}
            <RoznamaText variant="heading">{holiday.nameAr}</RoznamaText>
          </View>
          <RoznamaText color="muted" variant="caption">
            {holiday.description}
          </RoznamaText>
          <View style={styles.sectionTitleRow}>
            <CalendarDays color={theme.palette.primary} size={16} />
            <RoznamaText color="primary" variant="caption">
              {formatGregorianDate(holiday.date)}
            </RoznamaText>
          </View>
        </View>
        <View
          style={[
            styles.daysBlock,
            { backgroundColor: theme.palette.primary },
          ]}
        >
          <RoznamaText style={onPrimary} variant="caption">متبقٍ عليها</RoznamaText>
          <RoznamaText style={onPrimary} variant="title">
            {holiday.daysLeft}
          </RoznamaText>
          <RoznamaText style={onPrimary} variant="caption">
            {remainingDayLabel(holiday.daysLeft)}
          </RoznamaText>
        </View>
      </View>

      {nextEvent ? (
        <View style={styles.nextEvent}>
          <View style={styles.nextEventCopy}>
            <View style={styles.sectionTitleRow}>
              <Sparkles color={theme.palette.primary} size={16} />
              <RoznamaText color="primary" variant="label">
                الفعالية القادمة: {nextEvent.name}
              </RoznamaText>
            </View>
            <RoznamaText color="muted" variant="caption">
              {provinceLabel(nextEvent, 'ar')}
              {'  •  '}
              {formatEventDate(nextEvent.eventDate)}
              {nextEvent.eventTime ? `  •  ${nextEvent.eventTime}` : ''}
            </RoznamaText>
          </View>
          <AppButton
            icon={<ExternalLink color={theme.palette.primary} size={15} />}
            onPress={() => openExternal(eventDetailUrl(nextEvent))}
            variant="ghost"
          >
            التفاصيل
          </AppButton>
        </View>
      ) : null}
    </AppCard>
  );
}

function PrayerCard({
  activeGovernorate,
  activePrayer,
  query,
}: {
  activeGovernorate: string;
  activePrayer: ReturnType<typeof getActiveAndNextPrayer>;
  query: ReturnType<
    typeof useQuery<Awaited<ReturnType<typeof loadRoznamaPrayerSchedule>>>
  >;
}) {
  const { theme } = useAppTheme();
  const state = getWidgetQueryPresentation({
    fetchStatus: query.fetchStatus,
    hasData: Boolean(query.data),
    isError: query.isError,
    isPending: query.isPending,
  });
  return (
    <AppCard style={styles.sectionCard}>
      <View style={styles.sectionTitleRow}>
        <MoonStar color={theme.palette.primary} size={20} />
        <RoznamaText variant="heading">مواقيت الصلاة في {activeGovernorate}</RoznamaText>
      </View>
      {activePrayer ? (
        <View
          style={[
            styles.nextPrayer,
            {
              backgroundColor: `${theme.palette.primary}12`,
              borderColor: `${theme.palette.primary}44`,
            },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <PrayerIcon eventKey={activePrayer.next.key} size={22} />
            <RoznamaText color="primary" variant="heading">
              {activePrayer.next.isPrayer
                ? `صلاة ${activePrayer.next.label}`
                : activePrayer.next.label}
            </RoznamaText>
          </View>
          <View style={styles.countdownCopy}>
            <RoznamaText color="muted" variant="caption">المتبقي</RoznamaText>
            <RoznamaText color="primary" style={styles.countdown} variant="heading">
              {formatDuration(activePrayer.remainingMs)}
            </RoznamaText>
          </View>
        </View>
      ) : null}

      {state.loading ? (
        <View style={styles.loadingPrayer}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
        </View>
      ) : state.error || !query.data ? (
        <View style={styles.emptyState}>
          <AlertCircle color={theme.palette.danger} size={28} />
          <RoznamaText color="danger">تعذر تحميل مواقيت الصلاة.</RoznamaText>
          <AppButton onPress={() => void query.refetch()} variant="secondary">
            إعادة المحاولة
          </AppButton>
        </View>
      ) : (
        <View style={styles.prayerList}>
          {(
            [
              ['Fajr', 'الفجر'],
              ['Sunrise', 'الشروق'],
              ['Dhuhr', 'الظهر'],
              ['Asr', 'العصر'],
              ['Maghrib', 'المغرب'],
              ['Isha', 'العشاء'],
            ] as const
          ).map(([key, label]) => {
            const isActive = activePrayer?.active.key === key;
            const isNext = activePrayer?.next.key === key;
            const foreground = isActive
              ? theme.palette.primaryForeground
              : theme.palette.foreground;
            return (
              <View
                key={key}
                style={[
                  styles.prayerRow,
                  {
                    backgroundColor: isActive
                      ? theme.palette.primary
                      : isNext
                        ? `${theme.palette.primary}12`
                        : theme.palette.surfaceRaised,
                    borderColor: isActive || isNext
                      ? theme.palette.primary
                      : theme.palette.border,
                  },
                ]}
                testID={`roznama-prayer-${key}`}
              >
                <View style={styles.sectionTitleRow}>
                  <PrayerIcon
                    color={foreground}
                    eventKey={key}
                    size={18}
                  />
                  <RoznamaText style={{ color: foreground }} variant="label">
                    {label}
                  </RoznamaText>
                  {isActive ? <SmallBadge inverted label="الآن" /> : null}
                </View>
                <RoznamaText style={[styles.prayerTime, { color: foreground }]}>
                  {query.data.value.timings[key] ?? '--:--'}
                </RoznamaText>
              </View>
            );
          })}
        </View>
      )}
      {query.data && (query.data.cached || state.cached) ? (
        <RoznamaText color="muted" variant="caption">
          يتم عرض آخر مواقيت صلاة محفوظة.
        </RoznamaText>
      ) : null}
      <RoznamaText color="muted" style={styles.centerText} variant="caption">
        طريقة رابطة العالم الإسلامي (فجر 18° وعشاء 17°)، معتمد من وزارة الأوقاف.
      </RoznamaText>
    </AppCard>
  );
}

function PrayerIcon({
  color,
  eventKey,
  size,
}: {
  color?: string;
  eventKey: PrayerEventKey;
  size: number;
}) {
  const { theme } = useAppTheme();
  const props = { color: color ?? theme.palette.primary, size };
  if (eventKey === 'Fajr') {
    return <MoonStar {...props} />;
  }
  if (eventKey === 'Sunrise') {
    return <Sunrise {...props} />;
  }
  if (eventKey === 'Dhuhr') {
    return <Sun {...props} />;
  }
  if (eventKey === 'Asr') {
    return <SunDim {...props} />;
  }
  if (eventKey === 'Maghrib') {
    return <Sunset {...props} />;
  }
  return <Moon {...props} />;
}

function HolidayRow({
  currentTime,
  holiday,
}: {
  currentTime: Date;
  holiday: SyrianHoliday;
}) {
  const { theme } = useAppTheme();
  const today = new Date(
    currentTime.getFullYear(),
    currentTime.getMonth(),
    currentTime.getDate(),
  );
  const past = holiday.date < today;
  const days = Math.ceil(
    (holiday.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  return (
    <View
      style={[
        styles.holidayRow,
        {
          backgroundColor: theme.palette.surfaceRaised,
          borderColor: theme.palette.border,
          opacity: past ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.holidayCopy}>
        <View style={styles.sectionTitleRow}>
          {holiday.isNew ? <SmallBadge label="جديد" success /> : null}
          <RoznamaText variant="label">{holiday.nameAr}</RoznamaText>
        </View>
        <RoznamaText color="muted" variant="caption">
          {formatMonthDay(holiday.date)}  •  {holiday.description}
        </RoznamaText>
      </View>
      {past ? (
        <RoznamaText color="muted" variant="caption">منقضية</RoznamaText>
      ) : days === 0 ? (
        <SmallBadge label="اليوم" />
      ) : (
        <SmallBadge label={`متبقٍ ${days} يوم`} />
      )}
    </View>
  );
}

function SmallBadge({
  inverted = false,
  label,
  success = false,
}: {
  inverted?: boolean;
  label: string;
  success?: boolean;
}) {
  const { theme } = useAppTheme();
  // The active prayer row is already painted `primary`, so its badge has to swap
  // the pair the way the web page's bg-primary-foreground/text-primary does, or
  // it disappears into the row it sits on.
  const background = success
    ? theme.palette.success
    : inverted
      ? theme.palette.primaryForeground
      : theme.palette.primary;
  const foreground = success
    ? '#ffffff'
    : inverted
      ? theme.palette.primary
      : theme.palette.primaryForeground;
  return (
    <View style={[styles.smallBadge, { backgroundColor: background }]}>
      <RoznamaText style={[styles.centerText, { color: foreground }]} variant="caption">
        {label}
      </RoznamaText>
    </View>
  );
}

function SourceLink({ label, url }: { label: string; url: string }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => openExternal(url)}
      style={({ pressed }) => [
        styles.sourceLink,
        {
          borderColor: theme.palette.primary,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <ExternalLink color={theme.palette.primary} size={14} />
      <RoznamaText color="primary" style={styles.shrink} variant="caption">
        {label}
      </RoznamaText>
    </Pressable>
  );
}

function formatClock(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatGregorianDate(date: Date): string {
  return date.toLocaleDateString('ar-SY', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('ar-SY', {
    day: 'numeric',
    month: 'long',
  });
}

function formatEventDate(value: string): string {
  const date = parseLocalDate(value);
  return date ? formatGregorianDate(date) : value;
}

function formatHijriFallback(date: Date): string {
  try {
    const formatted = new Intl.DateTimeFormat('ar-SY-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
  } catch {
    return '';
  }
}

function remainingDayLabel(days: number): string {
  if (days === 0) {
    return 'اليوم!';
  }
  if (days === 1) {
    return 'يوم واحد';
  }
  if (days === 2) {
    return 'يومان';
  }
  return 'يوم';
}

function openExternal(url: string): void {
  void openSafeExternalUrl(url).catch(() => undefined);
}

const styles = StyleSheet.create({
  arabicText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardHeader: {
    alignItems: 'flex-start',
    gap: 12,
  },
  centerText: {
    textAlign: 'center',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  clock: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 42,
    fontVariant: ['tabular-nums'],
    lineHeight: 54,
    textAlign: 'center',
  },
  clockCard: {
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    fontVariant: ['tabular-nums'],
  },
  countdownCopy: {
    alignItems: 'flex-start',
  },
  daysBlock: {
    alignItems: 'center',
    borderRadius: 16,
    minWidth: 105,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 120,
    padding: 16,
  },
  governorateCard: {
    gap: 12,
  },
  holidayCopy: {
    flex: 1,
    gap: 3,
  },
  holidayRow: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  loadingPage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  loadingPrayer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  nextEvent: {
    alignItems: 'center',
    borderTopColor: 'rgba(127,127,127,0.25)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  nextEventCopy: {
    flex: 1,
    gap: 3,
  },
  nextPrayer: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'space-between',
    padding: 13,
  },
  notesCard: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  notesCopy: {
    flex: 1,
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  prayerList: {
    gap: 8,
  },
  prayerRow: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    padding: 11,
  },
  prayerTime: {
    fontVariant: ['tabular-nums'],
  },
  screen: {
    direction: 'rtl',
    gap: 16,
    width: '100%',
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  // long Arabic source credits have to wrap on a 360dp phone, not run off the card
  shrink: {
    flexShrink: 1,
  },
  smallBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sourceLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(127,127,127,0.25)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  upcomingCard: {
    gap: 12,
  },
  upcomingCopy: {
    flex: 1,
    gap: 6,
  },
  upcomingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 14,
    justifyContent: 'space-between',
  },
  weatherCopy: {
    flex: 1,
    gap: 1,
  },
  weatherRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  weatherWrap: {
    gap: 6,
    marginTop: 12,
    width: '100%',
  },
  widgetState: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
    width: '100%',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Roznama/Index.tsx (1057 lines)
  confidence: high
  todos:      0
  notes:      Native RTL cards preserve clock, weather, prayer, holidays, filters,
              F3alia events, cache states, notes, and source links.
              Fixed 2026-09: prayer times and weather now read syrian.zone's own
              /api/prayer-times and /api/weather proxies first (Damascus day
              boundary, timings trimmed of their "(EEST)" suffix) and keep Aladhan
              and the Cloudflare worker only as fallbacks; an empty hijri date from
              the proxy falls through to the local calendar instead of blanking the
              line; the active prayer row's "الآن" badge inverts so it is no longer
              primary-on-primary; text drawn on `primary` reads primaryForeground
              instead of a hardcoded white; the Arabic copy stays right aligned when
              the app locale is English; the next-event line names its province and
              the events card carries the F3alia credit plus the "browse the other
              provinces" action the web page has.
  known gap:  countdowns still compare Damascus prayer times against the device
              clock, exactly as the web page compares them against the browser
              clock. A phone outside Asia/Damascus sees a shifted countdown.
*/
