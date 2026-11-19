import { Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, Linking, ScrollView, Share, View } from 'react-native';
import { api } from './api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from './components';
import { matchesSearch, promiseCounterLabel, promiseSourceTypes, promiseStates, promiseVenues } from './domain';
import type { RootNavigation, RootRoutes } from './navigation';
import { useResource } from './resource';
import { NativeAction, NativeThemeHost } from './ui/native';
import { useTheme } from './ui/theme';

const promisesUrl = 'https://syrian.zone/promises';
const stateOptions = [{ key: '', label: 'كل الحالات' }, ...promiseStates];
const stateLabel = (state: string): string => promiseStates.find(option => option.key === state)?.label ?? 'حالة غير معروفة';
const updateLabels = new Map([
  ['progress', 'تحديث التقدّم'],
  ['status_change', 'تغيير الحالة'],
  ['official_response', 'رد رسمي'],
  ['note', 'ملاحظة'],
  ['deadline_change', 'تغيير الموعد'],
]);

function usePromiseAction(): { error: string | null; perform(action: () => Promise<unknown>, message: string): void } {
  const [error, setError] = useState<string | null>(null);
  function perform(action: () => Promise<unknown>, message: string): void {
    setError(null);
    void action().catch(() => {
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    });
  }
  return { error, perform };
}

export function PromisesScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const resource = useResource(api.promises);
  const { colors } = useTheme();
  const { error, perform } = usePromiseAction();
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const results = useMemo(() => resource.data?.promises.filter(promise => {
    if (state && promise.state !== state) return false;
    const searchable = [promise.title, promise.number, promise.sector, promise.institution, ...promise.tags,
      ...promise.speakers.map(speaker => speaker.name)].filter(Boolean).join(' ');
    return matchesSearch(searchable, query);
  }) ?? [], [resource.data, query, state]);
  const stats = resource.data?.stats;

  return <AdaptivePanes primary={<FlatList
    data={results}
    keyExtractor={item => String(item.number)}
    keyboardDismissMode="on-drag"
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={contentStyle}
    ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}>
      <Heading>عداد الوعود</Heading>
      {stats ? <Section>
        <Label>{`الوعود المنشورة ${stats.total} · تحقّق منها ${stats.fulfilled} · تأخّر ${stats.overdue}`}</Label>
      </Section> : null}
      <RequestStatus resource={resource} />
      {stats?.total ? <>
        <SearchField value={query} onChange={setQuery} placeholder="ابحث عن وعد أو مسؤول أو قطاع" />
        <NativeThemeHost matchContents={{ vertical: true }}>
          <Picker label="حالة الوعد" selection={state} onSelectionChange={setState} modifiers={[pickerStyle('menu')]}>
            {stateOptions.map(option => <Text key={option.key} modifiers={[tag(option.key)]}>{option.label}</Text>)}
          </Picker>
        </NativeThemeHost>
      </> : null}
      <NativeAction title="اقترح وعداً عبر الموقع" systemImage="arrow.up.forward.square"
        onPress={() => perform(() => Linking.openURL(`${promisesUrl}/suggest`), 'تعذّر فتح نموذج الاقتراح. حاول مرة أخرى.')} />
      {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
    </View>}
    ListEmptyComponent={stats ? <EmptyState title={stats.total ? 'لا توجد وعود مطابقة' : 'لا توجد وعود منشورة بعد'} /> : undefined}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item }) => <Row title={item.title}
      subtitle={[stateLabel(item.state), item.speakers.map(speaker => speaker.name).filter(Boolean).join('، '),
        promiseCounterLabel(item.counter)].filter(Boolean).join(' · ')}
      onPress={() => navigation.push('Promise', { number: item.number })} />}
  />} />;
}

export function PromiseScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const { params } = useRoute<RouteProp<RootRoutes, 'Promise'>>();
  const load = useCallback((signal: AbortSignal) => api.promise(params.number, signal), [params.number]);
  const resource = useResource(load);
  const { colors } = useTheme();
  const { error, perform } = usePromiseAction();
  const promise = resource.data?.number === params.number ? resource.data : null;
  const counter = promise ? promiseCounterLabel(promise.counter) : null;
  const canonicalUrl = `${promisesUrl}/${params.number}`;
  const open = (link: string): void => perform(() => Linking.openURL(link), 'تعذّر فتح الرابط. حاول مرة أخرى.');

  return <AdaptivePanes primary={<View style={{ flex: 1 }}>
    {error ? <View style={{ padding: 18, backgroundColor: colors.surface }}><Label style={{ color: colors.danger }}>{error}</Label></View> : null}
    <ScrollView contentContainerStyle={contentStyle}>
      <RequestStatus resource={resource} />
      {promise ? <>
        <Heading subtitle={`الوعد رقم ${promise.number} · ${stateLabel(promise.state)}`}>{promise.title}</Heading>
        <Section>
          {promise.speakers.map((speaker, index) => speaker.name ? <View key={index}>
            <Label style={{ fontWeight: '700' }}>{speaker.name}</Label>
            {speaker.title ? <Label secondary>{speaker.title}</Label> : null}
          </View> : null)}
          <Label secondary>{[promise.institution, promise.sector, promise.region].filter(Boolean).join(' · ')}</Label>
          <Label>{promise.quoteIsVerbatim ? `«${promise.quote}»` : `${promise.quote} (بتصرّف)`}</Label>
          <Label secondary>{[promise.statementDate, promiseVenues.get(promise.statementVenue)].filter(Boolean).join(' · ')}</Label>
          {promise.summary ? <Label>{promise.summary}</Label> : null}
        </Section>
        <Section>
          <Heading>الموعد</Heading>
          {counter ? <Label style={{ fontWeight: '700' }}>{counter}</Label> : null}
          <Label>{promise.deadlineDate ? `الموعد المعتمد ${promise.deadlineDate}` : 'لا يوجد موعد محدد'}</Label>
          {promise.deadlineWording ? <Label secondary>{`الموعد كما ورد في التصريح «${promise.deadlineWording}»`}</Label> : null}
          {promise.originalDeadlineDate ? <Label secondary>{`الموعد الأصلي ${promise.originalDeadlineDate}`}</Label> : null}
          {promise.resolvedAt ? <Label secondary>{`تاريخ الحكم ${promise.resolvedAt}`}</Label> : null}
          {promise.deadlineReasoning ? <Label secondary>{promise.deadlineReasoning}</Label> : null}
        </Section>
        {promise.target ? <Section>
          <Heading>الهدف والتقدّم</Heading>
          <Label>{`الهدف ${promise.target.value} ${promise.target.unit ?? ''}`.trim()}</Label>
          {promise.target.current !== null ? <Label>{`آخر قياس ${promise.target.current} ${promise.target.unit ?? ''}`.trim()}</Label> : null}
          {promise.target.percent !== null ? <Label>{`نسبة التقدّم ${promise.target.percent}%`}</Label> : null}
        </Section> : null}
        {promise.sources.length ? <Section>
          <Heading>المصادر</Heading>
          {promise.sources.map(source => {
            const { url, archiveUrl, outlet, type } = source;
            const title = outlet || promiseSourceTypes.get(type) || 'المصدر';
            return <View key={source.id} style={{ gap: 8 }}>
              <Label>{title}</Label>
              {source.publishedDate ? <Label secondary>{source.publishedDate}</Label> : null}
              {url ? <NativeAction title={`فتح المصدر · ${title}`} onPress={() => open(url)} /> : null}
              {archiveUrl ? <NativeAction title={`النسخة المؤرشفة · ${title}`} onPress={() => open(archiveUrl)} /> : null}
            </View>;
          })}
        </Section> : null}
        {promise.updates.length ? <Section>
          <Heading>السجل الزمني</Heading>
          {promise.updates.map(({ id, type, date, statusTo, body, sourceUrl, archiveUrl }) => <View key={id} style={{ gap: 8 }}>
            <Label style={{ fontWeight: '700' }}>{updateLabels.get(type) ?? 'تحديث'}</Label>
            <Label secondary>{[date, statusTo ? stateLabel(statusTo) : null].filter(Boolean).join(' · ')}</Label>
            {body ? <Label>{body}</Label> : null}
            {sourceUrl ? <NativeAction title={`مصدر التحديث · ${date}`} onPress={() => open(sourceUrl)} /> : null}
            {archiveUrl ? <NativeAction title={`النسخة المؤرشفة للتحديث · ${date}`} onPress={() => open(archiveUrl)} /> : null}
          </View>)}
        </Section> : null}
        {promise.related.length ? <Section>
          <Heading>وعود مرتبطة</Heading>
          {promise.related.map(item => <Row key={item.number} title={item.title}
            onPress={() => navigation.push('Promise', { number: item.number })} />)}
        </Section> : null}
        <Section>
          <Heading>توقّعات الجمهور</Heading>
          <Label>{`يتوقّعون تحقّق الوعد ${promise.votes.yes} · لا يتوقّعون تحقّقه ${promise.votes.no}`}</Label>
          <NativeAction title={promise.votingOpen ? 'التصويت أو الإبلاغ عبر الموقع' : 'فتح الوعد على الموقع'}
            systemImage="arrow.up.forward.square" onPress={() => open(canonicalUrl)} />
          <NativeAction title="مشاركة الوعد" systemImage="square.and.arrow.up"
            onPress={() => perform(() => Share.share({ message: promise.title, url: canonicalUrl }), 'تعذّرت المشاركة. حاول مرة أخرى.')} />
        </Section>
      </> : null}
    </ScrollView>
  </View>} />;
}
