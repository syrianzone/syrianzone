import type { FeatureScreenProps } from '../../platform/features';
import { DirectoryAdminScreen } from './DirectoryAdmin';
import { phonebookAdmin } from './admin-model';

export function PhonebookAdminScreen(props: FeatureScreenProps): React.JSX.Element { return <DirectoryAdminScreen {...props} definition={phonebookAdmin} />; }
// PORT STATUS: source resources/js/Pages/Admin/Phonebook/Index.tsx; confidence medium; todos 1 isolated authenticated native CRUD, filtering, toggle and reorder verification.
