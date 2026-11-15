import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, Photo, RequestStatus, Section } from '../../components';
import { useResource } from '../../resource';
import { MapView } from '../../MapView';
import { NativeAction, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { openExternal } from '../../platform/links';
import { usePages } from '../../platform/usePages';
import { decodeHotel, decodeHotelPage, type Hotel } from './model';

function Stars({ count }: { count: number | null }): React.JSX.Element | null { return count ? <View accessible accessibilityLabel={`${count} نجوم`} style={{ flexDirection: 'row', gap: 4 }}>{Array.from({ length: count }, (_, index) => <NativeSymbol key={index} name="star.fill" color="#D79012" size={18} />)}</View> : null; }
export function HotelsScreen({ onSelectHotel, header }: Partial<FeatureScreenProps> & { onSelectHotel?(id: number): void; header?: ReactNode } = {}): React.JSX.Element {
  const navigation = useFeatureNavigation();
  const resource = usePages(useCallback((page: number, signal: AbortSignal) => api.request('hotels', decodeHotelPage, { signal, params: { page } }), []));
  function open(hotel: Hotel): void { if (onSelectHotel) onSelectHotel(hotel.id); else navigation.open('hotel', { id: String(hotel.id) }); }
  return <FlatList data={resource.data?.items ?? []} keyExtractor={hotel => String(hotel.id)} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>{header}<Heading subtitle="بيانات من HalaSyria">الفنادق</Heading><RequestStatus resource={resource} /></View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد فنادق" /> : undefined}
    ListFooterComponent={resource.data && resource.data.currentPage < resource.data.lastPage ? <NativeAction title={resource.loadingMore ? 'جارٍ تحميل المزيد' : 'عرض المزيد'} disabled={resource.loadingMore} onPress={resource.more} /> : undefined}
    renderItem={({ item }) => <Section><Photo url={item.thumbnail} label={item.nameAr || item.name} height={170} /><Label style={{ fontWeight: '700' }}>{item.nameAr || item.name}</Label><Label secondary>{item.cityAr || item.city}</Label><Stars count={item.stars} />{item.rate !== null ? <Label>{item.rate.toLocaleString('ar-SY')} {item.currency}</Label> : null}<NativeAction title="تفاصيل الفندق" onPress={() => open(item)} /></Section>} />;
}
export function HotelScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const id = /^\d{1,10}$/.test(params.id ?? '') ? Number(params.id) : 0;
  const { colors } = useTheme();
  const resource = useResource(useCallback((signal: AbortSignal) => api.request(`hotels/${id}`, decodeHotel, { signal }), [id]), { enabled: id > 0 });
  const [index, setIndex] = useState(0), [error, setError] = useState<string | null>(null);
  const hotel = resource.data, images = hotel?.images ?? [];
  const openSource = (): void => { if (!hotel) return; setError(null); void openExternal(hotel.source).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح المصدر.')); };
  if (id < 1) return <EmptyState title="الفندق غير صالح" />;
  const map = hotel?.id === id && hotel.coordinate ? <MapView pins={[{ id: `hotel:${hotel.id}`, name: hotel.nameAr || hotel.name, coordinate: hotel.coordinate, symbol: 'bed.double' }]} /> : null;
  const content = (inlineMap: boolean): React.JSX.Element => <ScrollView contentContainerStyle={contentStyle}><RequestStatus resource={resource} />{hotel ? <>
    <Photo url={images[index % Math.max(1, images.length)] ?? hotel.thumbnail} label={hotel.nameAr || hotel.name} height={270} />
    {images.length > 1 ? <Section><Label>{index % images.length + 1} / {images.length}</Label><NativeAction title="الصورة السابقة" onPress={() => setIndex(current => (current + images.length - 1) % images.length)} /><NativeAction title="الصورة التالية" onPress={() => setIndex(current => (current + 1) % images.length)} /></Section> : null}
    <Heading subtitle={hotel.nameAr ? hotel.name : hotel.cityAr || hotel.city}>{hotel.nameAr || hotel.name}</Heading><Stars count={hotel.stars} />
    {hotel.descriptionAr || hotel.description ? <Section><Label>{hotel.descriptionAr || hotel.description}</Label></Section> : null}
    {inlineMap && map ? <Section><Heading>موقع الفندق</Heading><View style={{ height: 300 }}>{map}</View></Section> : null}
    <NativeAction title="اقرأ المزيد على HalaSyria" systemImage="arrow.up.forward" onPress={openSource} /><Label secondary>بيانات من HalaSyria</Label>{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
  </> : null}</ScrollView>;
  return <AdaptivePanes primary={content(false)} secondary={map ? <View style={{ flex: 1, padding: 18 }}>{map}</View> : null} compact={content(true)} />;
}
// PORT STATUS: source resources/js/Pages/Places/_components/HotelCard.tsx,HotelDetailView.tsx; confidence medium; todos 1 native list/gallery/source-link verification.
