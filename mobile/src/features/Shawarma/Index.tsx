import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { apiOrigin } from '@/lib/env';
import { openSafeExternalUrl } from '@/lib/linking';

const tiers = [
  {
    rank: 'S',
    color: '#ef4444',
    spots: [
      ['Just Shawarma', '/assets/shawarma/just-shawarma.png', 'https://www.instagram.com/justshawarma.sy/'],
      ['Alger', '/assets/shawarma/alager.png', 'https://www.instagram.com/shawrma.alaghr/'],
      ['Check In', '/assets/shawarma/checkin.jpg', 'https://www.instagram.com/checkin.sy/'],
      ['Sbenti', '/assets/shawarma/sbenti.png', 'https://www.facebook.com/p/Spenti-snak-100063744110605/'],
    ],
  },
  {
    rank: 'A',
    color: '#f97316',
    spots: [
      ['Kamal Ayash', '/assets/shawarma/Kamal-Ayash.jpg', 'https://www.instagram.com/kamalayash1/'],
      ['Paprika', '/assets/shawarma/paprika.jpg', 'https://www.instagram.com/paprika.syria'],
    ],
  },
  {
    rank: 'B',
    color: '#eab308',
    spots: [
      ['Shawerha', '/assets/shawarma/SHAWERHA.png', 'https://www.instagram.com/shawerhaofficial/'],
      ['Faruk', '/assets/shawarma/faruk.jpg', 'https://www.instagram.com/alfarouk.res/'],
      ['Abu Rateb', '/assets/shawarma/abu-rateb.png', 'https://www.instagram.com/aburatebchicken'],
    ],
  },
  {
    rank: 'C',
    color: '#22c55e',
    spots: [
      ['Alaga', '/assets/shawarma/alaga.png', 'https://www.facebook.com/alagha.Broast.shawarma/'],
    ],
  },
] as const;

export default function ShawarmaScreen() {
  const { theme } = useAppTheme();
  return (
    <Screen title="@macdoos's Shawarma Tier List">
      <AppCard style={styles.board}>
        {tiers.map((tier) => (
          <View
            key={tier.rank}
            style={[styles.tier, { borderBottomColor: theme.palette.border }]}
          >
            <View style={[styles.badge, { backgroundColor: theme.palette.surfaceRaised }]}>
              <AppText style={{ color: tier.color }} variant="title">{tier.rank}</AppText>
            </View>
            <View style={styles.spots}>
              {tier.spots.map(([name, logo, href]) => (
                <Pressable
                  accessibilityRole="link"
                  key={name}
                  onPress={() => void openSafeExternalUrl(href)}
                  style={styles.spot}
                >
                  <Image
                    accessibilityLabel={name}
                    contentFit="cover"
                    source={{ uri: new URL(logo, `${apiOrigin}/`).toString() }}
                    style={styles.image}
                    transition={150}
                  />
                  <AppText style={styles.name} variant="label">{name}</AppText>
                  <ExternalLink color={theme.palette.primary} size={14} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 64,
  },
  board: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  image: {
    borderRadius: 14,
    height: 76,
    width: 76,
  },
  name: {
    textAlign: 'center',
  },
  spot: {
    alignItems: 'center',
    gap: 4,
    width: 100,
  },
  spots: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  tier: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Shawarma/Index.tsx (131 lines)
  confidence: high
  todos:      0
  notes:      Native remote images and safe social links preserve every ranked restaurant.
*/
