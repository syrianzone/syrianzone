import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import platforms from '../../../../resources/data/social-platforms.json';
import { api } from '../../api';
import { Heading, Label, RequestStatus, SearchField, Section, contentStyle } from '../../components';
import { useResource } from '../../resource';
import { NativeAction, NativeSegmented, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { openExternal } from '../../platform/links';
import type { FeatureScreenProps } from '../../platform/features';
import { decodeOfficialPage, filterOfficials, type OfficialCategory, type OfficialEntity } from './model';
import { translations } from './translations.generated';
import { languageFlags, socialIcons } from './graphics.generated';
type Language = 'ar' | 'en' | 'tr' | 'ku';
type OfficialRow = { id: string; heading: OfficialCategory | null; items: OfficialEntity[] };
const BRAND_COLORS: Record<string, string> = { facebook: '#1877F2', instagram: '#E4405F', twitter: '#1DA1F2', telegram: '#26A5E4', linkedin: '#0A66C2', youtube: '#FF0000', whatsapp: '#25D366' };
function SocialLink({ platform, title, onPress }: { platform: string; title: string; onPress(): void }): React.JSX.Element {
  const { colors } = useTheme();
  const key = platform.replace(/_secondary$/, ''), xml = socialIcons[key];
  return <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, padding: 10, borderRadius: 12, backgroundColor: colors.elevated, opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 10 })}>
    {xml ? <SvgXml xml={xml.replaceAll('currentColor', BRAND_COLORS[key] ?? colors.accent)} width={24} height={24} /> : <NativeSymbol name={key === 'telegram' ? 'paperplane' : key === 'whatsapp' ? 'message' : 'globe'} color={BRAND_COLORS[key] ?? colors.accent} size={24} />}
    <Label style={{ flex: 1 }}>{title}</Label>
  </Pressable>;
}
function EntityCard({ item, language, category, open }: { item: OfficialEntity; language: Language; category: string; open(url: string): void }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const name = language === 'ar' ? item.nameAr : item.name;
  const description = language === 'ar' ? item.descriptionAr || item.description : item.description;
  return <Section style={{ flex: 1 }}>
    {item.image && !failed ? <Image source={{ uri: item.image }} onError={() => setFailed(true)} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={name} style={{ width: '100%', height: 96, borderRadius: 14 }} /> : <NativeSymbol name="building.2" size={42} />}
    <Label style={{ fontWeight: '700' }}>{name}</Label><Label secondary>{category}</Label>
    {description ? <Label>{description}</Label> : null}
    {Object.entries(item.socials).filter(([, url]) => url.trim()).map(([key, url]) => { const p = platforms.find(v => v.key === key || v.key === key.replace(/_secondary$/, '')); return <SocialLink key={key} platform={key} title={p ? language === 'ar' ? p.label_ar : p.label_en : key} onPress={() => open(url)} />; })}
  </Section>;
}
export function SyOfficialScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const [query, setQuery] = useState(params.q ?? '');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState<Language>('ar');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => api.page('/syofficial', 'SyOfficial/Index', decodeOfficialPage, { signal }), []);
  const resource = useResource(load);
  const results = useMemo(() => filterOfficials(resource.data?.items ?? [], query, category), [resource.data, query, category]);
  const rows = useMemo<OfficialRow[]>(() => {
    if (view === 'table') return results.map(item => ({ id: item.id, heading: null, items: [item] }));
    return (resource.data?.categories ?? []).flatMap(group => {
      const items = results.filter(item => item.category === group.id);
      return Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => ({
        id: `${group.id}:${index}`, heading: index === 0 ? group : null, items: items.slice(index * 2, index * 2 + 2)
      }));
    });
  }, [resource.data, results, view]);
  const t = translations[language];
  const open = (url: string): void => { setError(null); void openExternal(url).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح الرابط.')); };
  return <FlatList key={view} data={rows} keyExtractor={item => item.id} style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}><ProjectIcon name="syofficial" size={46} /><Heading subtitle={t.description}>{t.title}</Heading>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['ar', 'en', 'tr', 'ku'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === 'ar' ? 'العربية' : value === 'en' ? 'English' : value === 'tr' ? 'Türkçe' : 'Kurdî'} accessibilityState={{ checked: value === language }} onPress={() => setLanguage(value)} style={({ pressed }) => ({ minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: value === language ? colors.accentMuted : colors.surface, opacity: pressed ? 0.6 : 1, flexDirection: 'row', gap: 8, alignItems: 'center' })}><SvgXml xml={languageFlags[value] ?? ''} width={24} height={16} /><Label>{value.toUpperCase()}</Label></Pressable>)}</View>
      <SocialLink platform="twitter" title="قائمة تويتر" onPress={() => open('https://x.com/i/lists/1906101934660174006')} /><SocialLink platform="telegram" title="قائمة تلغرام" onPress={() => open('https://t.me/addlist/fKrhEy2yNeEwODQ0')} />
      <SearchField value={query} onChange={setQuery} placeholder={t.searchPlaceholder} />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{[{ id: '', labelAr: 'الكل', labelEn: 'All' }, ...(resource.data?.categories ?? [])].map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: category === c.id }} onPress={() => setCategory(current => current === c.id ? '' : c.id)} style={{ padding: 12, borderRadius: 12, backgroundColor: category === c.id ? colors.accentMuted : colors.surface }}><Label>{language === 'ar' ? c.labelAr : c.labelEn}</Label></Pressable>)}</ScrollView>
      <NativeSegmented options={[{ value: 'grid', label: t.grid }, { value: 'table', label: t.table }]} value={view} onChange={setView} /><RequestStatus resource={resource} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}<Label secondary>{results.length ? language === 'ar' ? `عرض ${results.length} حساب رسمي` : `Showing ${results.length} official accounts` : t.noResults}</Label>
    </View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <Section><Label>{t.noResults}</Label><Label secondary>{t.noResultsDesc}</Label><NativeAction title="مسح البحث والتصفية" onPress={() => { setQuery(''); setCategory(''); }} /></Section> : undefined}
    renderItem={({ item: row }) => <View style={{ gap: 12 }}>
      {row.heading ? <View accessible accessibilityRole="header" accessibilityLabel={language === 'ar' ? row.heading.labelAr : row.heading.labelEn} testID={`syofficial.category.${row.heading.id}`} style={{ borderBottomWidth: 1, borderColor: colors.separator, paddingBottom: 8 }}>
        <Label style={{ fontSize: 22, lineHeight: 32, fontWeight: '700' }}>{language === 'ar' ? row.heading.labelAr : row.heading.labelEn}</Label>
      </View> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>{row.items.map(item => <EntityCard key={item.id} item={item} language={language} category={resource.data?.categories.find(c => c.id === item.category)?.[language === 'ar' ? 'labelAr' : 'labelEn'] ?? item.category} open={open} />)}
        {view === 'grid' && row.items.length === 1 ? <View style={{ flex: 1 }} /> : null}
      </View>
    </View>} />;
}
// PORT STATUS: source resources/js/Pages/SyOfficial/Index.tsx; confidence medium; todos 1 native grouped grid, graphics and language verification.
