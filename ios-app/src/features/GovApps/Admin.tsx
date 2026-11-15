import type { FeatureScreenProps } from '../../platform/features';
import { DirectoryAdminScreen } from '../../platform/directory-admin/DirectoryAdmin';
import { govappsAdmin } from './admin-model';

export function GovAppsAdminScreen(props: FeatureScreenProps): React.JSX.Element { return <DirectoryAdminScreen {...props} definition={govappsAdmin} />; }
// PORT STATUS: source resources/js/Pages/Admin/GovApps/Index.tsx and _components/AppDialog.tsx; confidence medium; todos 1 isolated authenticated native CRUD, image and reorder verification.
