import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Font from 'expo-font';
import * as Clipboard from 'expo-clipboard';
import { SvgXml } from 'react-native-svg';
import media from '../../../../resources/data/media.json';
import { Heading, Label, Row, SearchField, Section, contentStyle } from '../../components';
import { NativeAction, NativePicker, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { artwork } from '../../ui/original-artwork.generated';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { openExternal } from '../../platform/links';
import { shareFile } from '../../platform/files';
import { colorPalettes, fontWeights, governorateArtwork, posterThemes } from './identity.generated';
import { originalProvinces } from './provinces.generated';
import { decodeProvinces, exportGeoJson, exportProvinceSvg, selectProvince, type Province } from './model';
import { recolorArtwork } from './svg';
import { SyriaMap } from './SyriaMap';
const BASE = 'https://syrian.zone';
const PAGES = [{ id: 'colors', title: 'الألوان' }, { id: 'fonts', title: 'الخطوط' }, { id: 'flag', title: 'العلم والشعارات والمواد الرسمية' }, { id: 'icons', title: 'أيقونات المحافظات' }, { id: 'map', title: 'خريطة سوريا الرقمية' }];
// PORT NOTE: The long source guide is divided into native child screens, preserving every tool and original download.
export function SyIdScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const page = params.page ?? 'overview';
  const navigation = useFeatureNavigation();
  const { colors, mode } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const [fontModal, setFontModal] = useState(false);
  const [format, setFormat] = useState<'TTF' | 'WOFF' | 'WOFF2'>('TTF');
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fontLoading, setFontLoading] = useState(false);
  const [poster, setPoster] = useState('default');
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selected, setSelected] = useState('full');
  const [govSearch, setGovSearch] = useState('');
  const selectedProvinces = useMemo(() => provinces.length ? selectProvince(provinces, selected) : [], [provinces, selected]);
  const theme = posterThemes.find(item => item.id === poster) ?? posterThemes[0];
  const act = (action: () => Promise<void>): void => { setNotice(null); void action().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'تعذر إكمال الطلب.')); };
  const copy = async (value: string): Promise<void> => { await Clipboard.setStringAsync(value); setNotice(`تم النسخ: ${value}`); };
  const download = (url: string, filename: string, mimeType: string): void => act(() => shareFile({ url, filename, mimeType }));
  const previewFont = async (): Promise<void> => { setFontLoading(true); try { await Font.loadAsync({ HayyakumAllah: { uri: `${BASE}/syid-assets/fonts/HayyakumAllah/TTF/HayyakumAllah-Regular.ttf` } }); setFontLoaded(true); } finally { setFontLoading(false); } };
  const title = PAGES.find(item => item.id === page)?.title ?? 'الهوية البصرية السورية';
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle}><Heading>{title}</Heading>{notice ? <Section><Label>{notice}</Label></Section> : null}
    {page === 'overview' ? <><SvgXml xml={artwork.logo!} width="100%" height={140} /><NativeAction title="الموقع الرسمي للهوية السورية" systemImage="arrow.up.right.square" onPress={() => act(() => openExternal('https://syrianidentity.sy'))} />{PAGES.map(item => <Row key={item.id} title={item.title} symbol={item.id === 'map' ? 'map' : 'paintpalette'} onPress={() => navigation.open('syid', { page: item.id })} />)}</> : null}
    {page === 'colors' ? colorPalettes.map(palette => <Section key={palette.name}><Heading>{palette.name}</Heading>{palette.colors.map(color => <View key={color.hex} style={{ borderRadius: 16, padding: 16, gap: 8, backgroundColor: color.hex }}>
      {(['hex', 'hsl', 'cmyk', 'oklch'] as const).map(key => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`نسخ ${key}: ${color[key]}`} onPress={() => act(() => copy(color[key]))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: color.textColor === 'white' ? '#FFFFFF' : '#000000', writingDirection: 'ltr', textAlign: 'left', fontSize: 14 }}>{key.toUpperCase()}  {color[key]}</Text></Pressable>)}
    </View>)}</Section>) : null}
    {page === 'fonts' ? <><Section><Heading>خط قمرة</Heading><Label>خط الهوية البصرية السورية. رمز الخصم syrianzone</Label><NativeAction title="نسخ رمز الخصم" systemImage="doc.on.doc" onPress={() => act(() => copy('syrianzone'))} /><NativeAction title="شراء خط قمرة" systemImage="arrow.up.right.square" onPress={() => act(() => openExternal('https://iwantype.com/product/qomra/'))} /></Section>
      <Section><Heading>خط حيّاكم الله</Heading><Label>أربعة أوزان بصيغ TTF وWOFF وWOFF2.</Label><NativeAction title="تحميل خط حيّاكم الله" systemImage="arrow.down.doc" onPress={() => setFontModal(true)} /><NativeAction title="تحميل المعاينة ومقارنة الخط" disabled={fontLoading || fontLoaded} systemImage="textformat" onPress={() => act(previewFont)} />{fontLoading ? <ActivityIndicator color={colors.accent} /> : null}{fontLoaded ? <><Label secondary>بخط حيّاكم الله</Label><Text style={{ fontFamily: 'HayyakumAllah', color: colors.text, fontSize: 30, textAlign: 'center' }}>الهوية البصرية السورية</Text><Label secondary>بخط قمرة</Label><Image source={{ uri: `${BASE}/syid-assets/materials/${mode === 'dark' ? 'whiteonblack' : 'blackonwhite'}.png` }} contentFit="contain" style={{ height: 80, width: '100%' }} accessibilityLabel="الهوية البصرية السورية بخط قمرة" /></> : null}</Section>
    </> : null}
    {page === 'flag' ? <><Section><Heading>العلم السوري ونسبه</Heading><SvgXml xml={artwork.flagProportions!} width="100%" height={300} /><NativeAction title="تحميل النسب PNG" onPress={() => download(`${BASE}/syid-assets/materials/syrian-flag-proportions.png`, 'نسب_العلم.png', 'image/png')} /><NativeAction title="تحميل النسب SVG" onPress={() => download(`${BASE}/syid-assets/materials/syrian-flag-proportions.svg`, 'نسب_العلم.svg', 'image/svg+xml')} /><NativeAction title="تحميل النسب DWG" onPress={() => download(`${BASE}/syid-assets/materials/syrian-flag.dwg`, 'نسب_العلم.dwg', 'image/vnd.dwg')} /></Section>
      <Section><Heading>الدليل الإرشادي للعلم السوري</Heading><Image source={{ uri: `${BASE}/syid-assets/materials/syrian-flag-guide.webp` }} accessibilityLabel="غلاف الدليل الإرشادي للعلم" style={{ width: '100%', height: 220 }} contentFit="contain" /><NativeAction title="حساب مصمم الدليل" onPress={() => act(() => openExternal('https://x.com/abd_hmh'))} /><NativeAction title="تحميل الدليل الإرشادي" onPress={() => act(() => openExternal('https://drive.google.com/uc?export=download&id=1-HbfWI2PC76TTR6rKpmGl7GDcUlcZFXl'))} /></Section>
      <Section><Heading>شعار الهوية والمواد الرسمية</Heading><SvgXml xml={artwork.logo!} width="100%" height={180} /><NativeAction title="تحميل الشعار SVG" onPress={() => download(`${BASE}/syid-assets/materials/logo.ai.svg`, 'شعار_الهوية.svg', 'image/svg+xml')} /><NativeAction title="تحميل المواد الرسمية ZIP" onPress={() => download(`${media.public_base}/downloads/191b8f0d278fc2ab095fb4f344e3e9b4-vGF1L1.zip`, 'الهوية_السورية.zip', 'application/zip')} /></Section>
    </> : null}
    {page === 'icons' ? <><NativeAction title="مصممة الأيقونات ولاء على X" onPress={() => act(() => openExternal('https://x.com/walaa_akdesign'))} /><NativeAction title="ولاء على إنستغرام" onPress={() => act(() => openExternal('https://www.instagram.com/walaa_akdesign/'))} /><NativeAction title="تحميل جميع الملفات الأصلية" onPress={() => act(() => openExternal('https://drive.google.com/drive/folders/1rRpQ98QKB_hnTofuN7zTVdk0YpH73CLL'))} /><NativePicker label="ألوان الأيقونات" options={posterThemes.map(item => ({ value: item.id, label: item.name }))} value={poster} onChange={setPoster} />
      {Object.entries(governorateArtwork).map(([id, icon]) => { const xml = recolorArtwork(artwork[icon.file]!, theme.primary, theme.bg); return <Section key={id} style={{ backgroundColor: theme.bg }}><Label style={{ color: theme.primary, fontWeight: '700' }}>{icon.landmark}</Label><SvgXml xml={xml} width="100%" height={280} /><NativeAction title={`تحميل ${icon.landmark} SVG`} onPress={() => act(() => shareFile({ text: xml, filename: `${id}_${poster}.svg`, mimeType: 'image/svg+xml' }))} /></Section>; })}
    </> : null}
    {page === 'map' ? <>{!provinces.length ? <Section><Label>خريطة سوريا التفاعلية، بحدود المحافظات الأصلية وتصدير SVG وGeoJSON.</Label><NativeAction title="تحميل الخريطة" systemImage="map" onPress={() => { try { setProvinces(decodeProvinces(originalProvinces())); } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر تحميل بيانات الخريطة.'); } }} /></Section> : <><SearchField value={govSearch} onChange={setGovSearch} placeholder="ابحث عن محافظة" /><NativePicker label="المحافظة" value={selected} onChange={setSelected} options={[{ value: 'full', label: 'سوريا كاملة' }, ...provinces.filter(province => province.name.includes(govSearch)).map(province => ({ value: province.id, label: province.name }))]} /><SyriaMap key={selected} provinces={selectedProvinces} onSelect={setSelected} /><Label>{selected === 'full' ? 'سوريا كاملة' : provinces.find(province => province.id === selected)?.name}</Label><NativeAction title="تصدير SVG" systemImage="square.and.arrow.up" onPress={() => act(() => shareFile({ text: exportProvinceSvg(selectedProvinces), filename: 'خريطة_سوريا.svg', mimeType: 'image/svg+xml' }))} /><NativeAction title="تصدير GeoJSON" onPress={() => act(() => shareFile({ text: exportGeoJson(selectedProvinces), filename: 'syria_provinces.geojson', mimeType: 'application/geo+json' }))} /></>}
      <NativeAction title="GeoJSON بدقة كاملة" onPress={() => download(`${media.public_base}/downloads/syria_provinces.geojson`, 'syria_provinces_full.geojson', 'application/geo+json')} /><NativeAction title="خريطة سوريا صماء من Wikimedia" onPress={() => act(() => openExternal('https://upload.wikimedia.org/wikipedia/commons/8/88/Blank_Syria_map.svg'))} /><NativeAction title="خريطة تضاريس سوريا من Wikimedia" onPress={() => act(() => openExternal('https://upload.wikimedia.org/wikipedia/commons/2/2d/Syria_physical_location_map.svg'))} />
    </> : null}
    <NativeAction title="الموقع الشخصي للمطور" onPress={() => act(() => openExternal('http://hadealahmad.com/'))} /><NativeAction title="حساب المطور على X" onPress={() => act(() => openExternal('https://x.com/hadealahmad'))} />
    <Modal visible={fontModal} presentationStyle="pageSheet" onRequestClose={() => setFontModal(false)}><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ ...contentStyle, paddingTop: 30 }}><Heading>تحميل خط حيّاكم الله</Heading><NativeSegmented options={[{ value: 'TTF', label: 'TTF' }, { value: 'WOFF', label: 'WOFF' }, { value: 'WOFF2', label: 'WOFF2' }]} value={format} onChange={setFormat} />{fontWeights.map(weight => <Section key={weight.file}><Label>{weight.nameAr}</Label><Label secondary>{weight.file}.{format.toLowerCase()}</Label><NativeAction title={`تحميل ${weight.nameAr}`} onPress={() => download(`${BASE}/syid-assets/fonts/HayyakumAllah/${format}/${weight.file}.${format.toLowerCase()}`, `${weight.file}.${format.toLowerCase()}`, `font/${format.toLowerCase()}`)} /></Section>)}{notice ? <Label>{notice}</Label> : null}<NativeAction title="تم" onPress={() => setFontModal(false)} /></ScrollView></Modal>
  </ScrollView>;
}
// PORT STATUS: source resources/js/Pages/SyId/SyidClient.tsx; confidence medium; todos 1 native artwork, font, gesture and file-export verification.
