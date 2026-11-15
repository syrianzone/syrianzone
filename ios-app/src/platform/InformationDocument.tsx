import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { AdaptivePanes, contentStyle, Heading, Label, Section } from '../components';
import { NativeAction } from '../ui/native';
import { useTheme } from '../ui/theme';
import type { InformationBlock, InformationValue } from './information-model';
export function InformationDocument({ document, onLink, sectionContent = {}, children }: { document: InformationValue; onLink(href: string): Promise<void>; sectionContent?: Readonly<Record<string, ReactNode>>; children?: ReactNode }): React.JSX.Element {
  const { colors } = useTheme(), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function visit(href: string): Promise<void> { if (busy) return; setBusy(true); setError(null); try { await onLink(href); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر فتح الرابط.'); } finally { setBusy(false); } }
  function block(item: InformationBlock, index: number): ReactNode {
    if (item.kind === 'link') return <NativeAction key={index} title={item.text} systemImage={item.href.startsWith('/') ? 'chevron.backward' : 'arrow.up.right'} disabled={busy} onPress={() => { void visit(item.href); }} />;
    if (item.kind === 'image') return <Image key={index} source={{ uri: item.src }} accessibilityLabel={item.text} contentFit="cover" cachePolicy="memory-disk" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.elevated }} />;
    return <Label key={index} {...(item.kind === 'heading' ? { accessibilityRole: 'header' as const } : {})} style={item.kind === 'heading' ? { fontWeight: '700' } : undefined}>{item.kind === 'item' ? '• ' : ''}{item.text}</Label>;
  }
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>
    <Heading subtitle={document.subtitle}>{document.title}</Heading>
    {document.sections.map((section, index) => {
      const overridden = Object.hasOwn(sectionContent, section.title), extra = sectionContent[section.title];
      if (overridden && extra == null || !overridden && !section.blocks.length) return null;
      return <Section key={index}><Label accessibilityRole="header" style={{ fontSize: 21, lineHeight: 31, fontWeight: '700' }}>{section.title}</Label>{section.subtitle ? <Label secondary>{section.subtitle}</Label> : null}
        {overridden ? extra : section.blocks.map(block)}</Section>;
    })}
    {document.footer.length ? <View style={{ gap: 12 }}>{document.footer.map(block)}</View> : null}
    {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}{children}
  </ScrollView>} />;
}
