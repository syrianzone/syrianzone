import type { FeatureScreenProps } from '../../platform/features';
import { DirectoryAdminScreen } from '../../platform/directory-admin/DirectoryAdmin';
import { syofficialAdmin } from './admin-model';

export function SyOfficialAdminScreen(props: FeatureScreenProps): React.JSX.Element { return <DirectoryAdminScreen {...props} definition={syofficialAdmin} />; }
// PORT STATUS: source resources/js/Pages/Admin/SyOfficial/Index.tsx and _components/EntityDialog.tsx; confidence medium; todos 1 isolated authenticated native CRUD, image, social links and reorder verification.
