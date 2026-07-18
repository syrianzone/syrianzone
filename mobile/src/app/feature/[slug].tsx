import { Redirect, useLocalSearchParams } from 'expo-router';

import { QueryState } from '@/components/ui/QueryState';
import AlignmentScreen from '@/features/Alignment/Index';
import CompassScreen from '@/features/Compass/Index';
import DashboardScreen from '@/features/Dashboard/Index';
import GovAppsScreen from '@/features/GovApps/Index';
import GuessWhoScreen from '@/features/GuessWho/Index';
import HouseScreen from '@/features/House/Index';
import JusticeScreen from '@/features/Justice/Index';
import PartyScreen from '@/features/Party/Index';
import PlacesScreen from '@/features/Places/Index';
import PhonebookScreen from '@/features/Phonebook/Index';
import PollsScreen from '@/features/Polls/Index';
import PopulationScreen from '@/features/Population/Index';
import PrioritiesScreen from '@/features/Priorities/Index';
import PrivacyScreen from '@/features/Privacy';
import RoznamaScreen from '@/features/Roznama/Index';
import ShawarmaScreen from '@/features/Shawarma/Index';
import SitesScreen from '@/features/Sites/Index';
import SyidScreen from '@/features/SyId/Index';
import SyOfficialScreen from '@/features/SyOfficial/Index';
import SyrianContributorsScreen from '@/features/SyrianContributors/Index';
import TermsScreen from '@/features/Terms';
import TierListScreen from '@/features/TierList/Index';

export default function FeatureRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  switch (slug) {
    case 'alignment':
      return <AlignmentScreen />;
    case 'compass':
      return <CompassScreen />;
    case 'contributors':
      return <SyrianContributorsScreen />;
    case 'dashboard':
      return <DashboardScreen />;
    case 'govapps':
      return <GovAppsScreen />;
    case 'guesswho':
      return <GuessWhoScreen />;
    case 'house':
      return <HouseScreen />;
    case 'justice':
      return <JusticeScreen />;
    case 'party':
      return <PartyScreen />;
    case 'places':
      return <PlacesScreen />;
    case 'phonebook':
      return <PhonebookScreen />;
    case 'polls':
      return <PollsScreen />;
    case 'population':
      return <PopulationScreen />;
    case 'priorities':
      return <PrioritiesScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    case 'roznama':
      return <RoznamaScreen />;
    case 'shawarma':
      return <ShawarmaScreen />;
    case 'sites':
      return <SitesScreen />;
    case 'syofficial':
      return <SyOfficialScreen />;
    case 'syid':
      return <SyidScreen />;
    case 'terms':
      return <TermsScreen />;
    case 'tierlist':
      return <TierListScreen />;
    case 'transit':
      return <Redirect href="/transit" />;
    default:
      return (
        <QueryState
          detail="هذا القسم غير متوفر في نسخة التطبيق الحالية."
          type="error"
        />
      );
  }
}
