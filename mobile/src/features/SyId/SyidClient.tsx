import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Map as MapIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { loadBundledProvinceData } from '@/lib/geojson/bundled';
import { openSafeExternalUrl } from '@/lib/linking';
import { featureToSVG, getGovernorateNameAr } from '@/lib/ported/geo-utils';

import {
  SYID_MATERIALS,
  SYID_MATERIALS_ZIP_URL,
  shareGeneratedFile,
  shareSyidAsset,
  syidAssetUrl,
} from './files';
import {
  filterGovernorates,
  governorateOptions,
  selectProvince,
  syrianIdentityPalettes,
} from './model';
import SyriaMap from './SyriaMap';

// The website draws these as dimension lines around a CSS flag diagram; native
// carries the same numbers as a callout list next to the reference image.
const flagMeasurements = [
  { label: 'العرض الكلي', value: '36' },
  { label: 'الارتفاع الكلي', value: '24' },
  { label: 'تقسيم العرض', value: '9 + 9 + 9 + 9' },
  { label: 'ارتفاع الأشرطة', value: '8 + 8 + 8' },
  { label: 'توزيع النجوم أفقياً', value: '6 + 6 + 3 + 6 + 3 + 6 + 6' },
  { label: 'هامش النجوم الرأسي', value: '6' },
] as const;

const externalLinks = {
  authorSite: 'http://hadealahmad.com/',
  authorX: 'https://x.com/hadealahmad',
  blankMap: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Blank_Syria_map.svg',
  font: 'https://iwantype.com/',
  guideline:
    'https://drive.google.com/uc?export=download&id=1-HbfWI2PC76TTR6rKpmGl7GDcUlcZFXl',
  guidelineAuthor: 'https://x.com/abd_hmh',
  identity: 'https://syrianidentity.sy',
  materials: SYID_MATERIALS_ZIP_URL,
  physicalMap:
    'https://upload.wikimedia.org/wikipedia/commons/2/2d/Syria_physical_location_map.svg',
} as const;

export default function SyidClient() {
  const { theme } = useAppTheme();
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedGov, setSelectedGov] = useState('full');
  const [govSearch, setGovSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundaries = useQuery({
    queryFn: loadBundledProvinceData,
    queryKey: ['bundled', 'syria-provinces'],
    staleTime: Infinity,
  });
  const options = useMemo(
    () => (boundaries.data ? governorateOptions(boundaries.data) : []),
    [boundaries.data],
  );
  const filteredGovernorates = useMemo(
    () => filterGovernorates(options, govSearch),
    [govSearch, options],
  );

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const showNotification = useCallback((message: string, duration = 2_500) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setNotification(message);
    timerRef.current = setTimeout(() => {
      setCopiedColor(null);
      setNotification(null);
    }, duration);
  }, []);

  const copyColor = async (hex: string) => {
    await Clipboard.setStringAsync(hex);
    setCopiedColor(hex);
    showNotification(`تم نسخ ${hex}`, 2_000);
  };

  const exportMap = async (format: 'geojson' | 'svg') => {
    if (!boundaries.data) {
      return;
    }
    const selection = selectProvince(boundaries.data, selectedGov);
    const suffix =
      selectedGov === 'full'
        ? 'كاملة'
        : getGovernorateNameAr(selectedGov).replace(/\s+/g, '_');
    try {
      const shared = await shareGeneratedFile(
        `خريطة_سوريا_${suffix}.${format}`,
        format === 'svg'
          ? featureToSVG(selection)
          : JSON.stringify(selection, null, 2),
        format === 'svg' ? 'image/svg+xml' : 'application/geo+json',
      );
      showNotification(
        shared ? 'تم تجهيز الملف للمشاركة' : 'المشاركة غير متاحة على هذا الجهاز',
      );
    } catch {
      showNotification('تعذر تجهيز الملف. حاول مرة أخرى.');
    }
  };

  const downloadAsset = async (
    relativePath: string,
    fileName: string,
    mimeType: string,
  ) => {
    try {
      const shared = await shareSyidAsset(relativePath, fileName, mimeType);
      showNotification(
        shared ? 'تم تجهيز الملف للمشاركة' : 'تعذر فتح الملف على هذا الجهاز',
      );
    } catch {
      showNotification('تعذر تنزيل الملف. تحقق من اتصالك وحاول مرة أخرى.');
    }
  };

  return (
    <Screen
      subtitle="مجموعة غير رسمية ومجمعة من أماكن متعددة بانتظار الإصدار الرسمي للهوية"
      title="عناصر الهوية البصرية السورية"
    >
      <AppButton
        icon={<ExternalLink color={theme.palette.primaryForeground} size={18} />}
        onPress={() => void openSafeExternalUrl(externalLinks.identity)}
      >
        زيارة الموقع الرسمي للهوية البصرية السورية
      </AppButton>

      <AppCard style={styles.section}>
        <AppText variant="title">لوحة الألوان</AppText>
        <AppText color="muted">يمكنك النقر على اللون لنسخ الرمز مباشرة</AppText>
        {syrianIdentityPalettes.map((palette) => (
          <View key={palette.name} style={styles.palette}>
            <AppText style={styles.center} variant="heading">{palette.name}</AppText>
            <View style={styles.colors}>
              {palette.colors.map((color) => (
                <Pressable
                  accessibilityLabel={`نسخ اللون ${color.hex}`}
                  accessibilityRole="button"
                  key={color.hex}
                  onPress={() => void copyColor(color.hex)}
                  style={[styles.color, { backgroundColor: color.hex }]}
                >
                  {copiedColor === color.hex ? (
                    <Check color={color.textColor} size={20} />
                  ) : (
                    <Copy color={color.textColor} size={18} />
                  )}
                  <AppText style={{ color: color.textColor }} variant="label">
                    {color.hex}
                  </AppText>
                  <AppText style={{ color: color.textColor }} variant="caption">
                    {color.cmyk.replaceAll(' ', '\n')}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="title">الخطوط</AppText>
        <AppText color="muted">
          احصل على خط قمرة المستخدم في الهوية البصرية السورية
        </AppText>
        <Image
          accessibilityLabel="خط قمرة"
          cachePolicy="disk"
          contentFit="contain"
          source={{ uri: syidAssetUrl(SYID_MATERIALS.qomra) }}
          style={styles.preview}
        />
        <AppButton
          icon={<ExternalLink color={theme.palette.primaryForeground} size={18} />}
          onPress={() => void openSafeExternalUrl(externalLinks.font)}
        >
          شراء الخطوط من iWantype
        </AppButton>
        <AppText color="muted" style={styles.center}>
          استخدم كود الخصم syrianzone للخصم 25% على خط قمرة
        </AppText>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="title">العلم السوري ونسبه</AppText>
        <AppText color="muted">
          النسب الدقيقة لتصميم العلم السوري الرسمي، بوحدات المخطط الرسمي.
        </AppText>
        <Image
          accessibilityLabel="العلم السوري بالنسب الصحيحة"
          cachePolicy="disk"
          contentFit="contain"
          source={{ uri: syidAssetUrl(SYID_MATERIALS.flagProportionsPng) }}
          style={styles.flag}
        />
        <View style={styles.measurements} testID="syid-flag-measurements">
          {flagMeasurements.map((item) => (
            <View key={item.label} style={styles.measurement}>
              <AppText color="muted" variant="caption">{item.label}</AppText>
              <AppText variant="label">{item.value}</AppText>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <AppButton
            icon={<Download color={theme.palette.primaryForeground} size={18} />}
            onPress={() =>
              void downloadAsset(
                SYID_MATERIALS.flagProportionsPng,
                'العلم السوري بالنسب الصحيحة.png',
                'image/png',
              )
            }
            testID="syid-flag-png"
          >
            تحميل PNG
          </AppButton>
          <AppButton
            icon={<FileDown color={theme.palette.foreground} size={18} />}
            onPress={() =>
              void downloadAsset(
                SYID_MATERIALS.flagProportionsSvg,
                'العلم السوري بالنسب الصحيحة.svg',
                'image/svg+xml',
              )
            }
            testID="syid-flag-svg"
            variant="secondary"
          >
            تحميل SVG
          </AppButton>
          <AppButton
            onPress={() =>
              void downloadAsset(
                SYID_MATERIALS.flagDwg,
                'علم سوريا.dwg',
                'application/acad',
              )
            }
            testID="syid-flag-dwg"
            variant="secondary"
          >
            تحميل DWG
          </AppButton>
        </View>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="title">الدليل الإرشادي للعلم السوري</AppText>
        <AppText color="muted">
          الدليل الإرشادي الرسمي والتعليمات الخاصة باستخدام العلم ونسبه وتطبيقاته.
        </AppText>
        <Pressable onPress={() => void openSafeExternalUrl(externalLinks.guidelineAuthor)}>
          <AppText color="primary" style={styles.center}>
            إعداد ومساهمة: عبدالرحمن حداد (@abd_hmh)
          </AppText>
        </Pressable>
        <Image
          accessibilityLabel="الدليل الإرشادي للعلم السوري"
          cachePolicy="disk"
          contentFit="contain"
          source={{ uri: syidAssetUrl(SYID_MATERIALS.flagGuide) }}
          style={styles.preview}
        />
        <AppButton
          icon={<Download color={theme.palette.primaryForeground} size={18} />}
          onPress={() => void openSafeExternalUrl(externalLinks.guideline)}
        >
          تحميل ملف الدليل الإرشادي (PDF)
        </AppButton>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="title">المواد والموارد</AppText>
        <AppText color="muted">
          تحميل المواد الرسمية والموارد المرئية للهوية البصرية السورية الجديدة.
        </AppText>
        <Image
          accessibilityLabel="شعار الهوية البصرية السورية"
          cachePolicy="disk"
          contentFit="contain"
          source={{ uri: syidAssetUrl(SYID_MATERIALS.logo) }}
          style={styles.logo}
        />
        <AppButton
          icon={<Download color={theme.palette.primaryForeground} size={18} />}
          onPress={() => void openSafeExternalUrl(externalLinks.materials)}
        >
          تحميل المواد والموارد الرسمية
        </AppButton>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="title">خريطة سوريا</AppText>
        <AppText color="muted">
          عرض وتحميل الخرائط الرسمية للجمهورية العربية السورية بصيغ مختلفة وبدقة عالية.
        </AppText>
        <AppInput
          onChangeText={setGovSearch}
          placeholder="بحث عن محافظة..."
          value={govSearch}
        />
        <View style={styles.governorates}>
          <AppButton
            onPress={() => setSelectedGov('full')}
            variant={selectedGov === 'full' ? 'primary' : 'secondary'}
          >
            سوريا كاملة
          </AppButton>
          {filteredGovernorates.map((governorate) => (
            <AppButton
              key={governorate.id}
              onPress={() => setSelectedGov(governorate.id)}
              variant={selectedGov === governorate.id ? 'primary' : 'secondary'}
            >
              {governorate.nameAr}
            </AppButton>
          ))}
        </View>
        {govSearch && filteredGovernorates.length === 0 ? (
          <QueryState detail="لا توجد نتائج للبحث." type="empty" />
        ) : null}
        <View style={styles.actions}>
          <AppButton onPress={() => void exportMap('svg')}>تحميل SVG</AppButton>
          <AppButton onPress={() => void exportMap('geojson')} variant="secondary">
            تحميل GeoJSON
          </AppButton>
        </View>
        {boundaries.isError ? (
          <QueryState onRetry={() => void boundaries.refetch()} type="error" />
        ) : boundaries.data ? (
          <View style={styles.map}>
            <SyriaMap geoJsonData={boundaries.data} selectedGovId={selectedGov} />
          </View>
        ) : (
          <AppText color="muted">جار تحميل الخريطة المحلية...</AppText>
        )}

        <AppText variant="heading">مصادر أخرى</AppText>
        <AppButton
          icon={<MapIcon color={theme.palette.foreground} size={18} />}
          onPress={() => void openSafeExternalUrl(externalLinks.blankMap)}
          variant="secondary"
        >
          خريطة سوريا الصماء (SVG)
        </AppButton>
        <AppButton
          icon={<MapIcon color={theme.palette.foreground} size={18} />}
          onPress={() => void openSafeExternalUrl(externalLinks.physicalMap)}
          variant="secondary"
        >
          خريطة جغرافية (SVG)
        </AppButton>
      </AppCard>

      {notification ? (
        <AppCard style={styles.notification}>
          <AppText color="success" style={styles.center}>{notification}</AppText>
        </AppCard>
      ) : null}

      <View style={styles.footer}>
        <AppText style={styles.center}>© 2025 syrian.zone</AppText>
        <AppText color="muted" style={styles.center}>تم التطوير بواسطة هادي الأحمد</AppText>
        <View style={styles.actions}>
          <AppButton
            onPress={() => void openSafeExternalUrl(externalLinks.authorSite)}
            variant="ghost"
          >
            الموقع الشخصي
          </AppButton>
          <AppButton
            onPress={() => void openSafeExternalUrl(externalLinks.authorX)}
            variant="ghost"
          >
            حساب X
          </AppButton>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  color: {
    flex: 1,
    gap: 5,
    justifyContent: 'flex-end',
    minHeight: 150,
    minWidth: 95,
    padding: 10,
  },
  colors: {
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  flag: {
    aspectRatio: 1.5,
    width: '100%',
  },
  footer: {
    gap: 8,
    paddingVertical: 20,
  },
  governorates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  logo: {
    height: 180,
    width: '100%',
  },
  measurement: { flexGrow: 1, gap: 2, minWidth: 104 },
  measurements: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  map: {
    borderRadius: 16,
    height: 480,
    overflow: 'hidden',
  },
  notification: {
    borderColor: '#428177',
  },
  palette: {
    gap: 8,
  },
  preview: {
    height: 280,
    width: '100%',
  },
  section: {
    gap: 14,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/SyId/SyidClient.tsx (561 lines)
  confidence: high
  todos:      0
  notes:      Native clipboard, downloads, offline boundaries, filters, maps, source links, palettes,
              and credits preserve the identity guide. Material URLs track the published filenames and
              the flag card carries the website diagram's measurements as callout text.
*/
