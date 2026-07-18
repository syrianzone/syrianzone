import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { aboutMarkdown } from '@/data/about';
import {
  parseAboutMarkdown,
  type AboutInlineToken,
} from '@/lib/content/aboutMarkdown';
import { openSafeExternalUrl } from '@/lib/linking';

function InlineTokens({ tokens }: { tokens: readonly AboutInlineToken[] }) {
  const { theme } = useAppTheme();
  return (
    <>
      {tokens.map((token, index) => {
        const key = `${token.type}-${index}`;
        if (token.type === 'text') {
          return token.value;
        }
        if (token.type === 'bold') {
          return (
            <Text key={key} style={styles.bold}>
              <InlineTokens tokens={token.children} />
            </Text>
          );
        }
        return (
          <Text
            accessibilityRole="link"
            key={key}
            onPress={() => void openSafeExternalUrl(token.href)}
            style={[styles.link, { color: theme.palette.primary }]}
          >
            <InlineTokens tokens={token.children} />
          </Text>
        );
      })}
    </>
  );
}

export default function About() {
  const blocks = parseAboutMarkdown(aboutMarkdown);

  return (
    <Screen title="عن المساحة السورية">
      <AppCard style={styles.content}>
        {blocks.map((block, index) => {
          const key = `${block.type}-${index}`;
          if (block.type === 'h1') {
            return (
              <AppText key={key} variant="title">
                <InlineTokens tokens={block.children} />
              </AppText>
            );
          }
          if (block.type === 'h2') {
            return (
              <AppText key={key} variant="heading">
                <InlineTokens tokens={block.children} />
              </AppText>
            );
          }
          if (block.type === 'list') {
            return (
              <View key={key} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={`${key}-${itemIndex}`} style={styles.listItem}>
                    <AppText color="primary">•</AppText>
                    <AppText style={styles.listCopy}>
                      <InlineTokens tokens={item} />
                    </AppText>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <AppText key={key}>
              <InlineTokens tokens={block.children} />
            </AppText>
          );
        })}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontFamily: 'IBMPlexSansArabic_700Bold',
  },
  content: {
    gap: 14,
  },
  link: {
    textDecorationLine: 'underline',
  },
  list: {
    gap: 8,
  },
  listCopy: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    gap: 8,
  },
});
