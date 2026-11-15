import { useFeatureNavigation } from '../../platform/features';
import { InformationDocument } from '../../platform/InformationDocument';
import { decodeInformation } from '../../platform/information-model';
import { openExternal } from '../../platform/links';
import { Label } from '../../components';
import source from './content.json';
const document = decodeInformation({ ...source, footer: [...source.footer, { kind: 'link', text: 'إدارة تفضيلات الخصوصية على الموقع', href: 'https://syrian.zone/privacy', src: '' }] });
export function PrivacyScreen(): React.JSX.Element {
  const navigation = useFeatureNavigation();
  return <InformationDocument document={document} onLink={async href => { if (href === '/dashboard') navigation.open('account'); else await openExternal(href); }}>
    <Label secondary>تفضيلات إحصاءات الموقع تخص متصفحك. لا تتضمن نسخة iOS الحالية Google Analytics.</Label>
  </InformationDocument>;
}
export default PrivacyScreen;

// PORT STATUS: source resources/js/Pages/Privacy.tsx; confidence medium; todos 1 native policy actions verification. Browser Analytics consent remains scoped to the browser.
