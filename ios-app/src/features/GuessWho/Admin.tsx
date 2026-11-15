import type { FeatureScreenProps } from '../../platform/features';
import { DirectoryAdminScreen } from '../../platform/directory-admin/DirectoryAdmin';
import { guesswhoAdmin } from './admin-model';

export function GuessWhoAdminScreen(props: FeatureScreenProps): React.JSX.Element { return <DirectoryAdminScreen {...props} definition={guesswhoAdmin} />; }
// PORT STATUS: source resources/js/Pages/Admin/GuessWho/Index.tsx and _components/{CategoryDialog,CharacterDialog}.tsx; confidence medium; todos 1 isolated authenticated native category/character CRUD, cascade and image verification.
