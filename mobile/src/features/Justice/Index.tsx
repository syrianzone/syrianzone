import { Image } from 'expo-image';
import { Scale, UserRound, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { apiOrigin } from '@/lib/env';

import data from './_data/detainees';

const detainedNames = new Set<string>(
  data.individuals.map((person) => person.name),
);

function assetUrl(path: string): string {
  return new URL(path, `${apiOrigin}/`).toString();
}

function PersonImage({
  name,
  photo,
  size = 58,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  const { theme } = useAppTheme();
  return photo ? (
    <Image
      accessibilityLabel={name}
      contentFit="cover"
      source={{ uri: assetUrl(photo) }}
      style={{ borderRadius: 12, height: size, width: size }}
      transition={150}
    />
  ) : (
    <View
      style={[
        styles.fallback,
        {
          backgroundColor: theme.palette.surfaceRaised,
          height: size,
          width: size,
        },
      ]}
    >
      <UserRound color={theme.palette.mutedForeground} size={size * 0.45} />
    </View>
  );
}

export default function JusticeScreen() {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase('ar');
  const people = useMemo(
    () =>
      data.individuals.filter(
        (person) =>
          !normalized ||
          person.name.toLocaleLowerCase('ar').includes(normalized) ||
          person.role.toLocaleLowerCase('ar').includes(normalized),
      ),
    [normalized],
  );

  return (
    <Screen
      subtitle="قوائم وإحصائيات الموقوفين وهيكل القيادة السابق"
      title="العدالة الانتقالية"
      trailing={<Scale color={theme.palette.primary} size={28} />}
    >
      <AppCard style={styles.summary}>
        <AppText color="muted">إجمالي الموقوفين</AppText>
        <AppText color="primary" variant="title">
          {data.meta.totalDetainees.toLocaleString('en-US')}
        </AppText>
        <AppText color="muted" variant="caption">
          منهم {data.meta.rankedTotal.toLocaleString('en-US')} من أصحاب الرتب العسكرية
        </AppText>
      </AppCard>

      <AppText variant="heading">القائمة السوداء</AppText>
      <AppText color="muted" variant="caption">
        الإشارة ✕ تعني أن الاسم مدرج ضمن قائمة الموقوفين.
      </AppText>
      <MemberCard member={data.hierarchy.root} />
      {data.hierarchy.groups.map((group) => (
        <AppCard key={group.title} style={styles.group}>
          <AppText variant="heading">{group.title}</AppText>
          {group.members.map((member, index) => (
            <MemberCard key={`${member.name}-${index}`} member={member} />
          ))}
        </AppCard>
      ))}

      <AppText variant="heading">أصحاب الرتب العسكرية</AppText>
      <View style={styles.rankGrid}>
        {data.ranks.map((rank) => (
          <AppCard key={rank.ar} style={styles.rank}>
            <AppText variant="heading">{rank.count.toLocaleString('en-US')}</AppText>
            <AppText color="muted" variant="caption">{rank.ar}</AppText>
          </AppCard>
        ))}
      </View>

      <AppText variant="heading">أبرز الموقوفين</AppText>
      <AppInput
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو الوصف"
        value={search}
      />
      {people.map((person) => (
        <AppCard key={person.name} style={styles.person}>
          <PersonImage name={person.name} photo={person.photo} size={76} />
          <View style={styles.personCopy}>
            <AppText variant="label">{person.name}</AppText>
            <AppText color="muted" variant="caption">{person.role}</AppText>
          </View>
        </AppCard>
      ))}
      <AppText color="muted" variant="caption">
        المصدر: {data.meta.source}، حتى {data.meta.asOf}
      </AppText>
    </Screen>
  );
}

function MemberCard({
  member,
}: {
  member: { name: string; role?: string; photo?: string };
}) {
  const { theme } = useAppTheme();
  const detained = detainedNames.has(member.name);
  return (
    <View
      style={[
        styles.member,
        {
          backgroundColor: theme.palette.surface,
          borderColor: detained ? theme.palette.danger : theme.palette.border,
        },
      ]}
    >
      {detained ? <X color={theme.palette.danger} size={20} /> : null}
      <PersonImage name={member.name} photo={member.photo} />
      <View style={styles.personCopy}>
        <AppText variant="label">{member.name}</AppText>
        {member.role ? (
          <AppText color="muted" variant="caption">{member.role}</AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
  },
  group: {
    gap: 10,
  },
  member: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  person: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  personCopy: {
    flex: 1,
    gap: 3,
  },
  rank: {
    alignItems: 'center',
    minWidth: 90,
    width: '30%',
  },
  rankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summary: {
    alignItems: 'center',
    gap: 3,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Justice/Index.tsx (181 lines)
  confidence: high
  todos:      0
  notes:      Native cards preserve hierarchy, detained markers, ranks, people, sources, and filtering.
*/
