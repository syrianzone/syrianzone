import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import { AdaptivePanes, contentStyle, Heading, Label, Section } from '../../components';
import { NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { justice, type Person } from './model';

const detainedNames = new Set(justice.individuals.map(person => person.name));
function Portrait({ person }: { person: Person }): React.JSX.Element {
  const { colors } = useTheme(); const [failed, setFailed] = useState(false);
  return person.photo && !failed ? <Image source={{ uri: person.photo }} accessibilityLabel={person.name} contentFit="cover" cachePolicy="memory-disk" onError={() => setFailed(true)} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.elevated }} />
    : <View accessible accessibilityLabel={`لا تتوفر صورة ${person.name}`} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }}><NativeSymbol name="person" size={32} /></View>;
}
function PersonCard({ person, hierarchy }: { person: Person; hierarchy?: boolean }): React.JSX.Element {
  const { colors } = useTheme(); const detained = hierarchy && detainedNames.has(person.name);
  return <Section style={{ borderWidth: detained ? 1 : 0, borderColor: colors.danger, marginBottom: 10 }}><View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}><Portrait person={person} /><View style={{ flex: 1, gap: 4 }}><Label style={{ fontWeight: '700' }}>{person.name}</Label>{person.role ? <Label secondary>{person.role}</Label> : null}{detained ? <Label style={{ color: colors.danger }}>✕ مدرج ضمن قائمة الموقوفين</Label> : null}</View></View></Section>;
}
export function JusticeScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const asOf = new Intl.DateTimeFormat('ar-SY', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${justice.meta.asOf}T12:00:00Z`));
  return <AdaptivePanes primary={<FlatList data={justice.individuals} keyExtractor={(person, index) => `${person.name}:${index}`} contentContainerStyle={contentStyle}
    ListHeaderComponent={<View style={{ gap: 16 }}><ProjectIcon name="justice" size={52} /><Heading subtitle={'قائمة بأبرز مجرمي نظام الأسد الموقوفين لدى وزارة الداخلية السورية ضمن حملة "المخطط يليق بك"'}>العدالة الانتقالية</Heading><Label secondary>محدّث حتى {asOf}</Label>
      <Heading>القائمة السوداء</Heading><Label secondary>الإشارة✕ تعني أن الاسم مدرج ضمن قائمة الموقوفين.</Label><PersonCard person={justice.hierarchy.root} hierarchy />
      <View style={{ height: 20, width: 1, backgroundColor: colors.separator, alignSelf: 'center' }} />
      {justice.hierarchy.groups.map(group => <View key={group.title} style={{ gap: 8, borderWidth: 1, borderColor: colors.separator, borderRadius: 18, padding: 12 }}><Label accessibilityRole="header" style={{ fontWeight: '700', fontSize: 20 }}>{group.title}</Label>{group.members.map((person, index) => <PersonCard key={`${person.name}:${index}`} person={person} hierarchy />)}</View>)}
      <Section><Heading subtitle={`منهم ${justice.meta.rankedTotal.toLocaleString('en-US')} من أصحاب الرتب العسكرية`}>إجمالي الموقوفين</Heading><Label style={{ fontSize: 36, lineHeight: 46, fontWeight: '700', color: colors.accent }}>{justice.meta.totalDetainees.toLocaleString('en-US')}</Label><Label accessibilityRole="header">أصحاب الرتب العسكرية من الموقوفين</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{justice.ranks.map(rank => <View key={rank.ar} style={{ width: '45%', padding: 10, gap: 4, borderRadius: 12, backgroundColor: colors.elevated }}><Label style={{ fontSize: 22, fontWeight: '700' }}>{rank.count.toLocaleString('en-US')}</Label><Label secondary>{rank.ar}</Label></View>)}</View></Section>
      <Heading subtitle={`${justice.individuals.length} من رموز النظام`}>أبرز الموقوفين</Heading></View>}
    renderItem={({ item }) => <PersonCard person={item} />} ListFooterComponent={<Label secondary>المصدر: {justice.meta.source}. تعكس هذه الصفحة البيانات المنشورة حتى {asOf}.</Label>} />} />;
}
// PORT STATUS: source resources/js/Pages/Justice/Index.tsx; confidence medium; todos 0.
