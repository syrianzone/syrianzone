import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';

export interface LegalSection {
  paragraphs: readonly string[];
  title: string;
}

export function LegalDocument({
  intro,
  sections,
  title,
}: {
  intro: string;
  sections: readonly LegalSection[];
  title: string;
}) {
  return (
    <Screen subtitle={intro} title={title}>
      {sections.map((section) => (
        <AppCard key={section.title} style={styles.section}>
          <AppText variant="heading">{section.title}</AppText>
          {section.paragraphs.map((paragraph, index) => (
            <View key={`${section.title}-${index}`} style={styles.paragraph}>
              <AppText>{paragraph}</AppText>
            </View>
          ))}
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    gap: 4,
  },
  section: {
    gap: 12,
  },
});
