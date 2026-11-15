import { useCallback, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeSegmented } from '../../ui/native';
import { transitAdminClient as client } from './api';
import { TransitImport } from './Import';
import { DRAFT_LABELS, filterDrafts, filterRoutes, LOG_LABELS, nextPending, ROUTE_LABELS } from './model';
import { CombineSheet, DraftReview, RouteTools } from './RouteTools';
import { CityPicker, GeometryMap, Messages, useTransitManager } from './Shared';
import { useTransitEditors } from './editor-state';

type Tab = 'drafts' | 'routes' | 'import' | 'logs';
const TABS = [
  { value: 'drafts', label: 'المسودات' },
  { value: 'routes', label: 'الخطوط' },
  { value: 'import', label: 'الاستيراد' },
  { value: 'logs', label: 'سجل النشاط' }
] as const;
const date = (value: string): string => new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function TransitAdminScreen(props: FeatureScreenProps): React.JSX.Element {
  const account = useAccount();
  const owner = JSON.stringify([account.sessionGeneration, account.user?.effective_permissions, account.user?.transit_scope]);
  return <TransitAdministration key={owner} {...props} />;
}
function TransitAdministration({ params }: FeatureScreenProps): React.JSX.Element {
  const manager = useTransitManager(),
    navigation = useFeatureNavigation(),
    generation = manager.account.sessionGeneration;
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.value === params.tab) ? (params.tab as Tab) : 'drafts');
  const [status, setStatus] = useState('all'),
    [city, setCity] = useState('all'),
    [query, setQuery] = useState('');
  const [draftId, setDraftId] = useState<number | null>(params.draft && /^\d+$/.test(params.draft) ? Number(params.draft) : null),
    [routeId, setRouteId] = useState<string | null>(params.route ?? null),
    [view, setView] = useState<'list' | 'detail'>(params.draft || params.route ? 'detail' : 'list');
  const [combining, setCombining] = useState(false);
  const editors = useTransitEditors();
  const allowed = manager.permissions.some((permission) => permission.startsWith('transit.')),
    canRead = manager.can('transit.review_drafts');
  const cities = useResource(
    useCallback((signal) => api.cities(signal), []),
    { enabled: manager.account.ready && allowed }
  );
  const visibleCities = (cities.data ?? []).filter((item) => manager.scope === null || manager.scope.includes(String(item.id)));
  const drafts = useResource(
    useCallback((signal) => client.drafts(generation, signal), [generation]),
    { enabled: canRead && tab === 'drafts' }
  );
  const routes = useResource(
    useCallback((signal) => client.routes(generation, signal), [generation]),
    { enabled: canRead && tab === 'routes' }
  );
  const logs = useResource(
    useCallback((signal) => client.logs(generation, signal), [generation]),
    { enabled: canRead && tab === 'logs' }
  );
  const selectedDraft = canRead && tab === 'drafts' ? (drafts.data?.find((item) => item.id === draftId) ?? null) : null;
  const selectedRoute = canRead && tab === 'routes' ? (routes.data?.find((item) => item.id === routeId) ?? null) : null;
  const geometry = useResource(
    useCallback((signal) => client.geometry(selectedRoute?.id ?? '', generation, signal), [selectedRoute?.id, generation]),
    { enabled: Boolean(selectedRoute && canRead && tab === 'routes') }
  );
  const changeTab = (value: Tab) => {
    setTab(value);
    setStatus('all');
    setCity('all');
    setQuery('');
    setView('list');
  };
  const changed = () => {
    routes.reload();
    drafts.reload();
    logs.reload();
    geometry.reload();
  };
  const openRoute = (id: string) => {
    setTab('routes');
    setRouteId(id);
    setView('detail');
  };
  const header = (
    <View style={{ gap: 14 }}>
      <Heading subtitle="مراجعة مساهمات النقل وإدارة الخطوط ضمن نطاق صلاحياتك">إدارة ترانزيت</Heading>
      <NativeAction title="العودة للنقل" onPress={() => navigation.open('transit')} />
      <RequestStatus resource={cities} />
      {manager.account.ready && !allowed ? (
        <EmptyState title="لا تملك صلاحية إدارة النقل" />
      ) : !manager.account.ready ? (
        <EmptyState title="جارٍ قراءة صلاحيات الحساب" />
      ) : (
        <>
          <NativePicker<Tab> label="قسم الإدارة" value={tab} onChange={changeTab} options={[...TABS]} disabled={manager.busy} />
          {manager.scope !== null ? (
            <Label secondary>النطاق: {visibleCities.map((item) => item.nameAr).join('، ') || 'لا توجد مدن متاحة'}</Label>
          ) : null}
          {tab !== 'import' && tab !== 'logs' ? (
            <NativeSegmented
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'القائمة' },
                { value: 'detail', label: 'الخريطة والتفاصيل' }
              ]}
            />
          ) : null}
        </>
      )}
      <Messages manager={manager} />
    </View>
  );
  if (!manager.account.ready || !allowed) return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>{header}</ScrollView>} />;
  if (tab === 'import')
    return (
      <TransitImport
        manager={manager}
        cities={visibleCities}
        header={header}
        onDraft={(id) => {
          setTab('drafts');
          setDraftId(id);
          setView('detail');
          drafts.reload();
        }}
        onPublished={(route) => {
          openRoute(route.id);
          routes.reload();
        }}
      />
    );
  if (!canRead)
    return (
      <AdaptivePanes
        primary={
          <ScrollView contentContainerStyle={contentStyle}>
            {header}
            <EmptyState title="تحتاج صلاحية مراجعة المسودات لعرض الخطوط والسجل" />
          </ScrollView>
        }
      />
    );
  if (tab === 'logs')
    return (
      <AdaptivePanes
        primary={
          <FlatList
            data={logs.data ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={contentStyle}
            ListHeaderComponent={
              <View style={{ gap: 12 }}>
                {header}
                <RequestStatus resource={logs} />
                <NativeAction title="تحديث السجل" onPress={logs.reload} disabled={logs.loading || manager.busy} />
                <Label secondary>أحدث {logs.data?.length ?? 0} نشاط ضمن نطاقك، بحد أقصى 200.</Label>
              </View>
            }
            renderItem={({ item }) => (
              <Section style={{ marginVertical: 6 }}>
                <Label style={{ fontWeight: '700' }}>{LOG_LABELS[item.action] ?? 'نشاط على الخط'}</Label>
                <Label>{item.description}</Label>
                <Label secondary>
                  {item.user ?? 'النظام'}، {date(item.createdAt)}
                </Label>
                {item.routeId ? <NativeAction title="عرض الخط المرتبط" onPress={() => openRoute(item.routeId!)} /> : null}
              </Section>
            )}
            ListEmptyComponent={!logs.loading && !logs.error ? <EmptyState title="لا توجد أنشطة" /> : <View />}
          />
        }
      />
    );
  const filteredDrafts = filterDrafts(drafts.data ?? [], status, city),
    filteredRoutes = filterRoutes(routes.data ?? [], status, city, query);
  const rows =
    tab === 'drafts'
      ? filteredDrafts.map((item) => ({
          key: String(item.id),
          title: item.name,
          subtitle: `${DRAFT_LABELS[item.status]}، ${item.city ?? item.cityId}، ${item.user ?? 'مجهول'}، ${date(item.createdAt)}`,
          selected: item.id === draftId,
          choose: () => {
            setDraftId(item.id);
            setView('detail');
          }
        }))
      : filteredRoutes.map((item) => ({
          key: item.id,
          title: item.name,
          subtitle: `${ROUTE_LABELS[item.status]}، ${item.city ?? item.cityId}، ${item.stopsCount} موقف`,
          selected: item.id === routeId,
          choose: () => {
            setRouteId(item.id);
            setView('detail');
          }
        }));
  const filters = (
    <View style={{ gap: 12 }}>
      {header}
      <RequestStatus<unknown> resource={tab === 'drafts' ? drafts : routes} />
      <CityPicker cities={visibleCities} value={city} onChange={setCity} all disabled={manager.busy} />
      <NativePicker
        label="الحالة"
        value={status}
        onChange={setStatus}
        disabled={manager.busy}
        options={[
          { value: 'all', label: 'كل الحالات' },
          ...Object.entries(tab === 'drafts' ? DRAFT_LABELS : ROUTE_LABELS).map(([value, label]) => ({ value, label }))
        ]}
      />
      {tab === 'routes' ? <SearchField value={query} onChange={setQuery} placeholder="ابحث باسم الخط" /> : null}
      {tab === 'drafts' && drafts.data ? (
        <Label secondary>
          انتظار {drafts.data.filter((item) => item.status === 'pending').length}، مقبول{' '}
          {drafts.data.filter((item) => item.status === 'approved').length}، مرفوض {drafts.data.filter((item) => item.status === 'rejected').length}.
          أحدث {drafts.data.length} مسودة بحد أقصى 500.
        </Label>
      ) : null}
      <NativeAction
        title="تحديث القائمة"
        onPress={tab === 'drafts' ? drafts.reload : routes.reload}
        disabled={manager.busy || (tab === 'drafts' ? drafts.loading : routes.loading)}
      />
      {tab === 'routes' && manager.can('transit.edit_routes') ? (
        <NativeAction title="دمج خطين" onPress={() => setCombining(true)} disabled={manager.busy || !routes.data} />
      ) : null}
      <Label secondary>{rows.length} نتيجة</Label>
    </View>
  );
  const list = (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={contentStyle}
      ListHeaderComponent={filters}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => <Row title={item.title} subtitle={item.subtitle} selected={item.selected} onPress={item.choose} />}
      ListEmptyComponent={
        !(tab === 'drafts' ? drafts.loading || drafts.error : routes.loading || routes.error) ? <EmptyState title="لا توجد نتائج" /> : <View />
      }
    />
  );
  const detail = (
    <ScrollView contentContainerStyle={contentStyle}>
      <NativeAction title="العودة إلى القائمة" onPress={() => setView('list')} />
      {view === 'detail' ? <Messages manager={manager} /> : null}
      {selectedDraft ? (
        <>
          <GeometryMap geometry={selectedDraft.geometry} cityId={selectedDraft.cityId} color={editors.draft(selectedDraft).state.color} onReferenceRoute={openRoute} />
          <DraftReview
            key={selectedDraft.id}
            draft={selectedDraft}
            editor={editors.draft(selectedDraft)}
            manager={manager}
            onReviewed={() => {
              setDraftId(nextPending(drafts.data ?? [], status, city, selectedDraft.id));
              changed();
            }}
          />
        </>
      ) : selectedRoute ? (
        <>
          <RequestStatus resource={geometry} />
          {geometry.data ? (
            <GeometryMap geometry={geometry.data} cityId={selectedRoute.cityId} color={selectedRoute.color} onReferenceRoute={openRoute} />
          ) : null}
          <RouteTools
            key={selectedRoute.id}
            route={selectedRoute}
            editor={editors.route(selectedRoute)}
            cities={visibleCities}
            manager={manager}
            onChanged={changed}
          />
        </>
      ) : (
        <>
          <RequestStatus<unknown> resource={tab === 'drafts' ? drafts : routes} />
          <EmptyState symbol="map" title="اختر مساراً من القائمة" detail="المسودة أو الخط المحدد سيظهر هنا مع الخريطة والإجراءات المتاحة." />
        </>
      )}
    </ScrollView>
  );
  return (
    <>
      <AdaptivePanes primary={list} secondary={detail} compact={view === 'list' ? list : detail} />
      <CombineSheet
        visible={combining}
        routes={routes.data ?? []}
        cities={visibleCities}
        manager={manager}
        onClose={() => setCombining(false)}
        onChanged={changed}
      />
    </>
  );
}
// PORT STATUS: source Transit/admin/Index.tsx and ImportTab.tsx; confidence medium; todos 2 native device review and controlled-account spatial round-trip.
