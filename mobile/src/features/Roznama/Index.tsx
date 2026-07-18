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
import { useEffect, useMemo, useState } from 'react';
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

function systemNow(): Date {
  return new Date();
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
                <AppText variant="label">المحافظة:</AppText>
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
                      <AppText
                        style={{
                          color: selected
                            ? theme.palette.primaryForeground
                            : theme.palette.foreground,
                        }}
                        variant="caption"
                      >
                        {item.ar}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            <AppCard style={styles.clockCard}>
              <AppText style={styles.clock}>{formatClock(currentTime)}</AppText>
              <AppText variant="label">{formatGregorianDate(currentTime)}</AppText>
              <AppText color="primary" variant="caption">
                {prayerQuery.data?.value.hijriDate ?? formatHijriFallback(currentTime)}
              </AppText>
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
                  <AppText variant="heading">
                    العطل الرسمية في سوريا ({currentYear}م)
                  </AppText>
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
                  <AppText variant="caption">إخفاء العطل المنقضية</AppText>
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
                  <AppText color="muted">
                    لا توجد عطلات رسمية متبقية لهذا العام.
                  </AppText>
                </View>
              )}

              <View style={styles.sourceRow}>
                <AppText color="muted" variant="caption">
                  المصدر: المرسوم رقم 188 لعام 2025
                </AppText>
                <SourceLink label="عرض المرسوم في المصدر" url={DECREE_URL} />
              </View>
            </AppCard>

            <AppCard style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.sectionTitleRow}>
                  <Sparkles color={theme.palette.primary} size={20} />
                  <AppText variant="heading">
                    {showAllEvents
                      ? 'الفعاليات القادمة في باقي المحافظات'
                      : `الفعاليات القادمة في ${activeGovernorate?.ar ?? 'دمشق'}`}
                  </AppText>
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
                  <AppText variant="caption">باقي المحافظات</AppText>
                </View>
              </View>
              <F3aliaEventsView
                governorate={governorate}
                language="ar"
                showHeader={false}
                state={eventsState}
                variant="grid"
              />
            </AppCard>

            <AppCard style={styles.notesCard}>
              <Info color={theme.palette.primary} size={22} />
              <View style={styles.notesCopy}>
                <AppText variant="label">
                  ملاحظات حول تعديلات العطل الرسمية (المرسوم 188 لعام 2025):
                </AppText>
                <AppText color="muted" variant="caption">
                  أعاد المرسوم تنظيم التقويم الوطني بإدراج أعياد جديدة (عيد الثورة السورية 18 آذار، وعيد التحرير الوطني 8 كانون الأول تخليداً لسقوط الاستبداد في 8 ديسمبر 2024). وفي المقابل، أُلغيت رسمياً عطل النظام البائد السابقة (انقلاب 8 آذار، ذكرى حرب تشرين 6 تشرين الأول، عيد الشهداء 6 أيار، وعطلة عيد المعلم كعطلة عامة للدولة) لتأسيس روزنامة وطنية جامعة بعيدة عن رموز عهد الاستبداد.
                </AppText>
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
        <AppText color="muted" variant="caption">جاري تحميل الطقس...</AppText>
      </View>
    );
  }
  if (state.error || !query.data) {
    return (
      <View style={styles.widgetState}>
        <AlertCircle color={theme.palette.danger} size={20} />
        <AppText color="danger" variant="caption">تعذر تحميل الطقس.</AppText>
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
          <AppText variant="label">{query.data.value.temperature}°C</AppText>
          <AppText color="muted" variant="caption">
            {weather.descriptionAr}
          </AppText>
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
          <AppText variant="caption">الطقس في {activeGovernorate}</AppText>
        </View>
      </View>
      {query.data.cached || state.cached ? (
        <AppText color="muted" variant="caption">
          يتم عرض آخر بيانات الطقس المحفوظة.
        </AppText>
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
  return (
    <AppCard style={styles.upcomingCard}>
      <AppText color="primary" variant="caption">المناسبة القادمة</AppText>
      <View style={styles.upcomingRow}>
        <View style={styles.upcomingCopy}>
          <View style={styles.sectionTitleRow}>
            {holiday.isNew ? <SmallBadge label="جديد" success /> : null}
            <AppText variant="heading">{holiday.nameAr}</AppText>
          </View>
          <AppText color="muted" variant="caption">
            {holiday.description}
          </AppText>
          <View style={styles.sectionTitleRow}>
            <CalendarDays color={theme.palette.primary} size={16} />
            <AppText color="primary" variant="caption">
              {formatGregorianDate(holiday.date)}
            </AppText>
          </View>
        </View>
        <View
          style={[
            styles.daysBlock,
            { backgroundColor: theme.palette.primary },
          ]}
        >
          <AppText style={styles.onPrimary} variant="caption">متبقٍ عليها</AppText>
          <AppText style={styles.onPrimary} variant="title">
            {holiday.daysLeft}
          </AppText>
          <AppText style={styles.onPrimary} variant="caption">
            {remainingDayLabel(holiday.daysLeft)}
          </AppText>
        </View>
      </View>

      {nextEvent ? (
        <View style={styles.nextEvent}>
          <View style={styles.nextEventCopy}>
            <View style={styles.sectionTitleRow}>
              <Sparkles color={theme.palette.primary} size={16} />
              <AppText color="primary" variant="label">
                الفعالية القادمة: {nextEvent.name}
              </AppText>
            </View>
            <AppText color="muted" variant="caption">
              {formatEventDate(nextEvent.eventDate)}
              {nextEvent.eventTime ? `  •  ${nextEvent.eventTime}` : ''}
            </AppText>
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
        <AppText variant="heading">مواقيت الصلاة في {activeGovernorate}</AppText>
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
            <AppText color="primary" variant="heading">
              {activePrayer.next.isPrayer
                ? `صلاة ${activePrayer.next.label}`
                : activePrayer.next.label}
            </AppText>
          </View>
          <View style={styles.countdownCopy}>
            <AppText color="muted" variant="caption">المتبقي</AppText>
            <AppText color="primary" style={styles.countdown} variant="heading">
              {formatDuration(activePrayer.remainingMs)}
            </AppText>
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
          <AppText color="danger">تعذر تحميل مواقيت الصلاة.</AppText>
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
              >
                <View style={styles.sectionTitleRow}>
                  <PrayerIcon
                    color={foreground}
                    eventKey={key}
                    size={18}
                  />
                  <AppText style={{ color: foreground }} variant="label">
                    {label}
                  </AppText>
                  {isActive ? <SmallBadge label="الآن" /> : null}
                </View>
                <AppText style={[styles.prayerTime, { color: foreground }]}>
                  {query.data.value.timings[key] ?? '--:--'}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
      {query.data && (query.data.cached || state.cached) ? (
        <AppText color="muted" variant="caption">
          يتم عرض آخر مواقيت صلاة محفوظة.
        </AppText>
      ) : null}
      <AppText color="muted" style={styles.centerText} variant="caption">
        طريقة رابطة العالم الإسلامي (فجر 18° وعشاء 17°)، معتمد من وزارة الأوقاف.
      </AppText>
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
          <AppText variant="label">{holiday.nameAr}</AppText>
        </View>
        <AppText color="muted" variant="caption">
          {formatMonthDay(holiday.date)}  •  {holiday.description}
        </AppText>
      </View>
      {past ? (
        <AppText color="muted" variant="caption">منقضية</AppText>
      ) : days === 0 ? (
        <SmallBadge label="اليوم" />
      ) : (
        <SmallBadge label={`متبقٍ ${days} يوم`} />
      )}
    </View>
  );
}

function SmallBadge({
  label,
  success = false,
}: {
  label: string;
  success?: boolean;
}) {
  const { theme } = useAppTheme();
  const background = success ? theme.palette.success : theme.palette.primary;
  return (
    <View style={[styles.smallBadge, { backgroundColor: background }]}>
      <AppText style={styles.onPrimary} variant="caption">{label}</AppText>
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
      <AppText color="primary" variant="caption">{label}</AppText>
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
  onPrimary: {
    color: '#ffffff',
    textAlign: 'center',
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
  notes:      Native RTL cards preserve clock, weather, prayer, holidays, filters, F3alia events, cache states, notes, and source links.
*/
