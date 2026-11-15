import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { api } from '../../api';
import { Label, RequestStatus, Row } from '../../components';
import { useFeatureNavigation } from '../../platform/features';
import { shareFile } from '../../platform/files';
import { InformationDocument } from '../../platform/InformationDocument';
import { decodeInformation } from '../../platform/information-model';
import { openExternal } from '../../platform/links';
import { externalUrl } from '../../platform/links-model';
import { array, assetUrl, integer, record, text } from '../../platform/validation';
import { useResource } from '../../resource';
import source from './content.json';
const document = decodeInformation(source);
export function AboutScreen(): React.JSX.Element {
  const navigation = useFeatureNavigation();
  const [linkError, setLinkError] = useState<string | null>(null);
  const contributors = useResource(useCallback(signal => api.page('/about', 'About', value => array(record(value).contributors).map(raw => { const row = record(raw); return { login: text(row.login), avatar: assetUrl(row.avatar), url: externalUrl(text(row.url)), count: integer(row.contributions) }; }), { signal }), []));
  async function visit(href: string): Promise<void> {
    if (href === '/privacy' || href === '/terms') { navigation.open(href.slice(1)); return; }
    if (href.includes('/downloads/brandkit-') && href.endsWith('.zip')) { await shareFile({ url: href, filename: 'SyrianZone-brandkit.zip', mimeType: 'application/zip' }); return; }
    await openExternal(href);
  }
  return <InformationDocument document={document} onLink={visit} sectionContent={{ 'مساهمو GitHub': contributors.loading || contributors.error || contributors.data?.length ? <View style={{ gap: 10 }}><RequestStatus resource={contributors} />{contributors.data?.map(person => <View key={person.login} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{person.avatar ? <Image source={{ uri: person.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} accessibilityLabel={person.login} /> : null}<View style={{ flex: 1 }}><Row title={person.login} subtitle={`${person.count} مساهمة`} onPress={() => { setLinkError(null); void openExternal(person.url).catch(() => setLinkError('تعذر فتح رابط المساهم. حاول مجدداً.')); }} /></View></View>)}</View> : null }}>
    <Label secondary>تُحمّل قائمة مساهمي GitHub من بيانات الموقع الحالية. تحتفظ الموارد الأصلية برخصها وإسناداتها الخاصة.</Label>
    {linkError ? <Label>{linkError}</Label> : null}
  </InformationDocument>;
}
export default AboutScreen;

// PORT STATUS: source resources/js/Pages/About.tsx; confidence medium; todos 1 native brand-kit share and contributor link verification.
