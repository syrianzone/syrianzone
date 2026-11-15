import { InformationDocument } from '../../platform/InformationDocument';
import { decodeInformation } from '../../platform/information-model';
import { openExternal } from '../../platform/links';
import source from './content.json';
const document = decodeInformation(source);
export function TermsScreen(): React.JSX.Element { return <InformationDocument document={document} onLink={openExternal} />; }
export default TermsScreen;

// PORT STATUS: source resources/js/Pages/Terms.tsx; confidence medium; todos 1 native policy text layout verification.
