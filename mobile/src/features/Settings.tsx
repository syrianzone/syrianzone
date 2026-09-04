import * as Location from 'expo-location';
import { Check, LocateFixed, Save } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { useHomeSettings } from '@/contexts/HomeSettingsContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { ensureNotificationPermission } from '@/lib/notifications/permissions';
import {
  type NotificationSettings,
  useNotificationSettings,
} from '@/lib/notifications/settings';
import {
  governorates,
  normalizeSearchTemplate,
  parseCoordinates,
  searchEngines,
} from '@/lib/ported/home';

const widgetSettings = [
  { key: 'showClock', ar: 'الساعة والتاريخ', en: 'Clock and date' },
  { key: 'showWeather', ar: 'حالة الطقس', en: 'Weather' },
  { key: 'showPrayerTimes', ar: 'الصلاة القادمة', en: 'Next prayer' },
  { key: 'showEvents', ar: 'الفعاليات', en: 'Events' },
  { key: 'showSearch', ar: 'البحث', en: 'Search' },
] as const;

const notificationSwitches = [
  {
    key: 'rankChanges',
    ar: 'تغيّر مراكز تير ليست الحكومة',
    en: 'Government tier list rank changes',
  },
  { key: 'emergencyWarnings', ar: 'تنبيهات الطوارئ', en: 'Emergency alerts' },
] as const;

export default function SettingsScreen() {
  const { settings, updateSettings } = useHomeSettings();
  const { direction, locale, setLocale } = useLocale();
  const { theme } = useAppTheme();
  const notifications = useNotificationSettings();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [latitudeDraft, setLatitudeDraft] = useState<string | null>(null);
  const [longitudeDraft, setLongitudeDraft] = useState<string | null>(null);
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [customSearchDraft, setCustomSearchDraft] = useState<string | null>(
    null,
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const latitude =
    latitudeDraft ??
    (settings.customCoordinates
      ? String(settings.customCoordinates.latitude)
      : '');
  const longitude =
    longitudeDraft ??
    (settings.customCoordinates
      ? String(settings.customCoordinates.longitude)
      : '');
  const customSearchUrl = customSearchDraft ?? settings.customSearchUrl;

  const saveCoordinates = async () => {
    const coordinates = parseCoordinates(latitude, longitude);
    if (!coordinates) {
      setCoordinateError(
        locale === 'ar'
          ? 'أدخل خط عرض بين -90 و90 وخط طول بين -180 و180.'
          : 'Enter a latitude from -90 to 90 and longitude from -180 to 180.',
      );
      return;
    }
    setCoordinateError(null);
    await updateSettings({ customCoordinates: coordinates });
  };

  const fillFromDeviceLocation = async () => {
    setLocating(true);
    setCoordinateError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setCoordinateError(
          locale === 'ar'
            ? 'لم يتم منح إذن الموقع. يمكنك إدخال الإحداثيات يدوياً.'
            : 'Location permission was not granted. You can enter coordinates manually.',
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinates = {
        latitude: Number(location.coords.latitude.toFixed(4)),
        longitude: Number(location.coords.longitude.toFixed(4)),
      };
      setLatitudeDraft(String(coordinates.latitude));
      setLongitudeDraft(String(coordinates.longitude));
      await updateSettings({
        customCoordinates: coordinates,
        useCustomCoordinates: true,
      });
    } catch {
      setCoordinateError(
        locale === 'ar'
          ? 'تعذر قراءة الموقع الآن. تحقق من إعدادات الجهاز أو أدخل الإحداثيات.'
          : 'Your location could not be read. Check device settings or enter coordinates.',
      );
    } finally {
      setLocating(false);
    }
  };

  const saveCustomSearch = async () => {
    const template = normalizeSearchTemplate(customSearchUrl);
    if (!template) {
      setSearchError(
        locale === 'ar'
          ? 'أدخل رابط بحث يبدأ بـ https:// أو http://. يمكنك استخدام %s لتحديد مكان عبارة البحث.'
          : 'Enter an http:// or https:// search URL. Use %s to choose where the query goes.',
      );
      return;
    }
    setSearchError(null);
    await updateSettings({ customSearchUrl: template, searchEngine: 'custom' });
  };

  // The switch stays off when the system denies permission; the caption explains why.
  const toggleNotification = async (
    key: keyof NotificationSettings,
    value: boolean,
  ) => {
    if (value && !(await ensureNotificationPermission())) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    await notifications.update({ [key]: value });
  };

  return (
    <Screen title={locale === 'ar' ? 'الإعدادات' : 'Settings'}>
      <AppCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">
            {locale === 'ar' ? 'اللغة والمظهر' : 'Language and theme'}
          </AppText>
          <ThemeToggle />
        </View>
        <View style={styles.choiceRow}>
          {(['ar', 'en'] as const).map((value) => (
            <Choice
              active={locale === value}
              key={value}
              label={value === 'ar' ? 'العربية' : 'English'}
              onPress={() => void setLocale(value)}
            />
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="heading">
          {locale === 'ar' ? 'الإشعارات' : 'Notifications'}
        </AppText>
        {notificationSwitches.map((item) => (
          <SwitchRow
            key={item.key}
            label={locale === 'ar' ? item.ar : item.en}
            onValueChange={(value) => void toggleNotification(item.key, value)}
            testID={`notifications-${item.key}`}
            value={notifications.settings[item.key]}
          />
        ))}
        {permissionDenied ? (
          <AppText color="danger" variant="caption">
            {locale === 'ar'
              ? 'الإشعارات متوقفة لهذا التطبيق في إعدادات النظام. فعّلها من إعدادات الجهاز ثم أعد المحاولة.'
              : 'Notifications are turned off for this app in system settings. Enable them in device settings and try again.'}
          </AppText>
        ) : null}
        <AppText color="muted" variant="caption">
          {locale === 'ar'
            ? 'يفحص التطبيق التحديثات في الخلفية كل 15 دقيقة تقريباً حسب سماح النظام.'
            : 'The app checks for updates in the background about every 15 minutes, as the system allows.'}
        </AppText>
      </AppCard>

      <AppCard style={styles.section}>
        <View
          style={[
            styles.switchRow,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
          ]}
        >
          <View style={styles.sectionCopy}>
            <AppText variant="heading">
              {locale === 'ar' ? 'إحداثيات مخصصة' : 'Custom coordinates'}
            </AppText>
            <AppText color="muted" variant="caption">
              {locale === 'ar'
                ? 'استخدم موقعاً دقيقاً للطقس ومواقيت الصلاة بدلاً من مركز المحافظة.'
                : 'Use a precise location for weather and prayer times instead of the governorate center.'}
            </AppText>
          </View>
          <Switch
            ios_backgroundColor={theme.palette.border}
            onValueChange={(value) =>
              void updateSettings({ useCustomCoordinates: value })
            }
            testID="home-use-custom-coordinates"
            thumbColor={theme.palette.surface}
            trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
            value={settings.useCustomCoordinates}
          />
        </View>
        {settings.useCustomCoordinates ? (
          <View style={styles.advancedFields}>
            <View style={styles.coordinateRow}>
              <AppInput
                accessibilityLabel={locale === 'ar' ? 'خط العرض' : 'Latitude'}
                keyboardType="numbers-and-punctuation"
                onChangeText={setLatitudeDraft}
                placeholder="33.5138"
                style={styles.coordinateInput}
                testID="home-custom-latitude"
                value={latitude}
              />
              <AppInput
                accessibilityLabel={locale === 'ar' ? 'خط الطول' : 'Longitude'}
                keyboardType="numbers-and-punctuation"
                onChangeText={setLongitudeDraft}
                placeholder="36.2765"
                style={styles.coordinateInput}
                testID="home-custom-longitude"
                value={longitude}
              />
            </View>
            {coordinateError ? (
              <AppText color="danger" variant="caption">
                {coordinateError}
              </AppText>
            ) : null}
            <View style={styles.actionRow}>
              <AppButton
                icon={<Save color={theme.palette.primaryForeground} size={17} />}
                onPress={() => void saveCoordinates()}
                testID="home-save-coordinates"
              >
                {locale === 'ar' ? 'حفظ الإحداثيات' : 'Save coordinates'}
              </AppButton>
              <AppButton
                icon={<LocateFixed color={theme.palette.foreground} size={17} />}
                loading={locating}
                onPress={() => void fillFromDeviceLocation()}
                testID="home-use-device-location"
                variant="secondary"
              >
                {locale === 'ar' ? 'استخدام موقعي' : 'Use my location'}
              </AppButton>
            </View>
          </View>
        ) : null}
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="heading">
          {locale === 'ar' ? 'بطاقات الصفحة الرئيسية' : 'Home widgets'}
        </AppText>
        {widgetSettings.map((item) => (
          <SwitchRow
            key={item.key}
            label={locale === 'ar' ? item.ar : item.en}
            onValueChange={(value) => void updateSettings({ [item.key]: value })}
            value={settings[item.key]}
          />
        ))}
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="heading">
          {locale === 'ar' ? 'تنسيق الساعة' : 'Clock format'}
        </AppText>
        <View style={styles.choiceRow}>
          {(['12', '24'] as const).map((value) => (
            <Choice
              active={settings.clockFormat === value}
              key={value}
              label={`${value} ${locale === 'ar' ? 'ساعة' : 'hour'}`}
              onPress={() => void updateSettings({ clockFormat: value })}
            />
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="heading">
          {locale === 'ar' ? 'المحافظة الافتراضية' : 'Default governorate'}
        </AppText>
        <ScrollView
          contentContainerStyle={styles.horizontalChoices}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {governorates.map((item) => (
            <Choice
              active={settings.governorate === item.id}
              key={item.id}
              label={locale === 'ar' ? item.ar : item.en}
              onPress={() => void updateSettings({ governorate: item.id })}
            />
          ))}
        </ScrollView>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="heading">
          {locale === 'ar' ? 'محرك البحث' : 'Search engine'}
        </AppText>
        <View style={styles.choiceWrap}>
          {searchEngines.map((engine) => (
            <Choice
              active={settings.searchEngine === engine}
              key={engine}
              label={
                engine === 'custom'
                  ? locale === 'ar'
                    ? 'مخصص'
                    : 'Custom'
                  : engine === 'searx'
                    ? 'SearX'
                    : engine
              }
              onPress={() => void updateSettings({ searchEngine: engine })}
            />
          ))}
        </View>
        {settings.searchEngine === 'custom' ? (
          <View style={styles.advancedFields}>
            <AppText color="muted" variant="caption">
              {locale === 'ar'
                ? 'استخدم %s لتحديد مكان عبارة البحث، مثل https://search.example/?q=%s. بدونه تضاف العبارة إلى نهاية الرابط.'
                : 'Use %s to choose where the query goes, such as https://search.example/?q=%s. Without it, the query is appended.'}
            </AppText>
            <AppInput
              accessibilityLabel={
                locale === 'ar' ? 'رابط البحث المخصص' : 'Custom search URL'
              }
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCustomSearchDraft}
              placeholder="https://search.example/?q=%s"
              testID="home-custom-search-url"
              value={customSearchUrl}
            />
            {searchError ? (
              <AppText color="danger" variant="caption">
                {searchError}
              </AppText>
            ) : null}
            <AppButton
              icon={<Save color={theme.palette.primaryForeground} size={17} />}
              onPress={() => void saveCustomSearch()}
              testID="home-save-custom-search"
            >
              {locale === 'ar' ? 'حفظ رابط البحث' : 'Save search URL'}
            </AppButton>
          </View>
        ) : null}
      </AppCard>
    </Screen>
  );
}

function SwitchRow({
  label,
  onValueChange,
  testID,
  value,
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
}) {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.switchRow,
        { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
      ]}
    >
      <AppText style={styles.switchLabel}>{label}</AppText>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor={theme.palette.border}
        onValueChange={onValueChange}
        testID={testID}
        thumbColor={theme.palette.surface}
        trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
        value={value}
      />
    </View>
  );
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: active
            ? theme.palette.surfaceRaised
            : theme.palette.surface,
          borderColor: active ? theme.palette.primary : theme.palette.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <AppText variant="label">{label}</AppText>
      {active ? <Check color={theme.palette.primary} size={17} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advancedFields: {
    gap: 10,
  },
  choice: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coordinateInput: {
    flex: 1,
    minWidth: 130,
  },
  coordinateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  horizontalChoices: {
    gap: 8,
  },
  section: {
    gap: 14,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flex: 1,
  },
  switchRow: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
  },
});
