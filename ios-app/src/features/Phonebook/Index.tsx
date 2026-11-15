import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '../../api';
import { Heading, Label, RequestStatus, SearchField, Section, contentStyle } from '../../components';
import { useResource } from '../../resource';
import { NativeAction, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { openExternal, openPhone } from '../../platform/links';
import type { FeatureScreenProps } from '../../platform/features';
import { callNumber, decodePhonebook, filterPhonebook, whatsappUrl } from './model';

export function PhonebookScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const [query, setQuery] = useState(params.q ?? '');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => api.page('/phonebook', 'Phonebook/Index', decodePhonebook, { signal }), []);
  const resource = useResource(load);
  const entries = useMemo(() => filterPhonebook(resource.data?.entries ?? [], query, category), [resource.data, query, category]);
  const act = (action: () => Promise<void>): void => { setNotice(null); void action().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'تعذر إكمال الطلب.')); };
  const copy = async (number: string): Promise<void> => { await Clipboard.setStringAsync(number); setNotice('تم نسخ الرقم.'); };
  return <FlatList key={view} data={entries} numColumns={view === 'grid' ? 2 : 1} keyExtractor={item => item.id}
    style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle} columnWrapperStyle={view === 'grid' ? { gap: 12 } : undefined}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}>
      <ProjectIcon name="phonebook" size={46} /><Heading subtitle="أرقام الطوارئ والاستعلامات والخدمات العامة">دليل الهاتف</Heading>
      <SearchField value={query} onChange={setQuery} placeholder="ابحث بالاسم أو الرقم" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {[{ id: '', labelAr: 'الكل' }, ...(resource.data?.categories ?? [])].map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: c.id === category }} onPress={() => setCategory(current => current === c.id ? '' : c.id)} style={{ padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: c.id === category ? colors.accentMuted : colors.surface }}><Label>{c.labelAr}</Label></Pressable>)}
      </ScrollView>
      <NativeSegmented options={[{ value: 'table', label: 'قائمة' }, { value: 'grid', label: 'بطاقات' }]} value={view} onChange={setView} />
      <RequestStatus resource={resource} />{notice ? <Label>{notice}</Label> : null}<Label secondary>{entries.length} نتيجة</Label>
    </View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <Section><Label>لم يتم العثور على أرقام.</Label><NativeAction title="مسح البحث والتصفية" onPress={() => { setQuery(''); setCategory(''); }} /></Section> : undefined}
    renderItem={({ item }) => <Section style={{ flex: 1 }}>
      <Label style={{ fontWeight: '700' }}>{item.nameAr}</Label>{item.nameEn ? <Label secondary>{item.nameEn}</Label> : null}
      <Label secondary>{item.categoryAr}</Label><Label style={{ fontSize: 22, writingDirection: 'ltr', textAlign: 'right' }}>{item.number}</Label>
      <NativeAction title="نسخ الرقم" systemImage="doc.on.doc" onPress={() => act(() => copy(item.number))} />
      <NativeAction title="اتصال" systemImage="phone" onPress={() => act(() => openPhone(callNumber(item.number)))} />
      {item.whatsapp ? <NativeAction title="واتساب" systemImage="message" onPress={() => act(() => openExternal(whatsappUrl(item.number)))} /> : null}
      {item.source ? <NativeAction title="المصدر الرسمي" systemImage="link" onPress={() => act(() => openExternal(item.source ?? ''))} /> : null}
    </Section>} />;
}
// PORT STATUS: source resources/js/Pages/Phonebook/Index.tsx; confidence medium; todos 1 native call/copy/WhatsApp and display verification.
