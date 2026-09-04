import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { aboutDocuments } from '@/data/about';
import {
  parseAboutMarkdown,
  type AboutInlineToken,
} from '@/lib/content/aboutMarkdown';
import type { Locale } from '@/lib/i18n/strings';
import { openSafeExternalUrl } from '@/lib/linking';

const languageLabels: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
};

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

function LanguageTab({
  language,
  onPress,
  selected,
}: {
  language: Locale;
  onPress: () => void;
  selected: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tab,
        {
          backgroundColor: selected
            ? theme.palette.primary
            : theme.palette.surface,
          borderColor: selected ? theme.palette.primary : theme.palette.border,
        },
      ]}
    >
      <AppText
        style={[
          styles.tabLabel,
          {
            color: selected
              ? theme.palette.primaryForeground
              : theme.palette.foreground,
          },
        ]}
        variant="label"
      >
        {languageLabels[language]}
      </AppText>
    </Pressable>
  );
}

export default function About() {
  const { locale } = useLocale();
  // The tabs follow the app language until the reader picks the other one, the
  // way the website tabs default to Arabic and stay wherever the reader put them.
  const [chosen, setChosen] = useState<Locale | null>(null);
  const language = chosen ?? locale;
  const blocks = parseAboutMarkdown(aboutDocuments[language]);
  const align = { textAlign: language === 'ar' ? 'right' : 'left' } as const;

  return (
    <Screen
      subtitle="منصة تفاعلية مفتوحة المصدر للشعب السوري | Open-source interactive space for Syria"
      title="عن المنصة | About Syrian Zone"
    >
      <View accessibilityRole="tablist" style={styles.tabs}>
        <LanguageTab
          language="ar"
          onPress={() => setChosen('ar')}
          selected={language === 'ar'}
        />
        <LanguageTab
          language="en"
          onPress={() => setChosen('en')}
          selected={language === 'en'}
        />
      </View>

      <AppCard style={styles.content}>
        {blocks.map((block, index) => {
          const key = `${block.type}-${index}`;
          if (block.type === 'h1') {
            return (
              <AppText key={key} style={align} variant="title">
                <InlineTokens tokens={block.children} />
              </AppText>
            );
          }
          if (block.type === 'h2') {
            return (
              <AppText key={key} style={align} variant="heading">
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
                    <AppText style={[styles.listCopy, align]}>
                      <InlineTokens tokens={item} />
                    </AppText>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <AppText key={key} style={align}>
              <InlineTokens tokens={block.children} />
            </AppText>
          );
        })}
      </AppCard>

      <View style={styles.footer}>
        <AppText
          accessibilityRole="link"
          color="primary"
          onPress={() => router.push('/feature/privacy')}
          variant="caption"
        >
          سياسة الخصوصية | Privacy Policy
        </AppText>
        <AppText
          accessibilityRole="link"
          color="primary"
          onPress={() => router.push('/feature/terms')}
          variant="caption"
        >
          الشروط والأحكام | Terms & Conditions
        </AppText>
      </View>
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
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
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
  tab: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  tabLabel: {
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/About.tsx (371 lines)
  confidence: high
  todos:      0
  notes:      Both language tabs, the eight contributor credits, the MIT and BrandKit links, the CC BY 4.0 icon attribution, and the privacy and terms footer, rendered from the bundled documents in src/data/about.ts.
*/
