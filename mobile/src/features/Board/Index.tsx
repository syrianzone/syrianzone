import {
  ArrowDown,
  ArrowUp,
  Check,
  Maximize2,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import {
  MAX_DASHBOARDS,
  MAX_WIDGETS,
  activeDashboard,
  addDashboard,
  addWidget,
  createDefaultDocument,
  migrateDocument,
  moveWidget,
  removeDashboard,
  removeWidget,
  renameDashboard,
  resizeWidget,
  selectDashboard,
  updateWidgetConfig,
  widgetWidthForViewport,
} from './model';
import { WIDGETS, findWidget } from './registry';
import {
  readBoardDocumentForAccount,
  writeBoardDocument,
} from './storage';
import { useBoardSync } from './sync';
import type {
  BoardDocument,
  WidgetConfigField,
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from './types';
import { WidgetRenderer } from './WidgetRenderer';

export default function BoardScreen() {
  const { user } = useAuth();
  const accountId = user?.id ?? null;

  return (
    <ScopedBoardScreen
      accountId={accountId}
      key={accountId === null ? 'guest' : `account:${accountId}`}
    />
  );
}

function ScopedBoardScreen({
  accountId,
}: {
  accountId: number | null;
}) {
  const { locale } = useLocale();
  const { theme } = useAppTheme();
  const viewport = useWindowDimensions();
  const [document, setDocument] = useState(createDefaultDocument);
  const [hydrated, setHydrated] = useState(false);
  const [hadLocal, setHadLocal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [sizeTarget, setSizeTarget] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<string | null>(null);

  // hadLocal decides whether sync uploads this document or adopts the server
  // one, so a promoted guest board has to count as local: that is the web path
  // where signing in with no server document keeps the guest board.
  useEffect(() => {
    let active = true;
    void readBoardDocumentForAccount(accountId).then((stored) => {
      if (!active) {
        return;
      }
      setHadLocal(stored !== null);
      setDocument((fallback) => migrateDocument(stored, fallback));
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [accountId]);

  useEffect(() => {
    if (hydrated) {
      void writeBoardDocument(document, accountId);
    }
  }, [accountId, document, hydrated]);

  const sync = useBoardSync({
    accountId,
    document,
    enabled: hydrated && accountId !== null,
    hadLocal,
    onAdopt: setDocument,
  });
  const dashboard = activeDashboard(document);
  const sizeWidget =
    dashboard.widgets.find((widget) => widget.i === sizeTarget) ?? null;
  const configWidget =
    dashboard.widgets.find((widget) => widget.i === configTarget) ?? null;

  return (
    <Screen
      subtitle={
        locale === 'ar'
          ? 'رتب أدواتك كما تحب'
          : 'Arrange your tools the way you like'
      }
      title={locale === 'ar' ? 'لوحتي' : 'My board'}
    >
      <View style={styles.toolbar}>
        <AppButton
          icon={
            editing ? (
              <Check color={theme.palette.primaryForeground} size={18} />
            ) : (
              <Pencil color={theme.palette.foreground} size={18} />
            )
          }
          onPress={() => setEditing((current) => !current)}
          variant={editing ? 'primary' : 'secondary'}
        >
          {editing
            ? locale === 'ar'
              ? 'تم'
              : 'Done'
            : locale === 'ar'
              ? 'تخصيص'
              : 'Customize'}
        </AppButton>
        {editing ? (
          <AppButton
            disabled={dashboard.widgets.length >= MAX_WIDGETS}
            icon={<Plus color={theme.palette.foreground} size={18} />}
            onPress={() => setGalleryOpen(true)}
            variant="secondary"
          >
            {locale === 'ar' ? 'إضافة' : 'Add'}
          </AppButton>
        ) : null}
      </View>

      <DashboardTabs
        document={document}
        editing={editing}
        onAdd={() =>
          setDocument((current) =>
            addDashboard(
              current,
              locale === 'ar'
                ? `لوحة ${current.dashboards.length + 1}`
                : `Board ${current.dashboards.length + 1}`,
            ),
          )
        }
        onRemove={(id) =>
          setDocument((current) => removeDashboard(current, id))
        }
        onRename={() => setRenameOpen(true)}
        onSelect={(id) =>
          setDocument((current) => selectDashboard(current, id))
        }
      />

      {sync.superseded ? (
        <AppCard style={styles.notice}>
          <AppText>
            {locale === 'ar'
              ? 'تم حفظ النسخة الأخرى ويمكن استعادتها'
              : 'The other version was saved and can be restored'}
          </AppText>
          <View style={styles.toolbar}>
            <AppButton onPress={sync.restore} variant="secondary">
              {locale === 'ar' ? 'استعادة النسخة السابقة' : 'Restore previous'}
            </AppButton>
            <AppButton onPress={sync.dismiss} variant="ghost">
              {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
            </AppButton>
          </View>
        </AppCard>
      ) : null}

      {sync.status === 'error' ? (
        <AppCard style={styles.notice}>
          <AppText color="danger">
            {locale === 'ar'
              ? 'تعذر مزامنة اللوحة. النسخة المحلية محفوظة.'
              : 'Board sync failed. Your local copy is saved.'}
          </AppText>
          <AppButton onPress={() => void sync.retry()} variant="secondary">
            {locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}
          </AppButton>
        </AppCard>
      ) : null}

      {dashboard.widgets.length === 0 ? (
        <AppCard style={styles.empty}>
          <AppText color="muted">
            {locale === 'ar'
              ? 'هذه اللوحة فارغة. اضغط إضافة لاختيار ويدجت.'
              : 'This board is empty. Tap Add to choose a widget.'}
          </AppText>
        </AppCard>
      ) : (
        <View style={styles.boardGrid}>
          {dashboard.widgets.map((widget, index) => (
            <BoardTile
              editing={editing}
              index={index}
              key={widget.i}
              onConfig={() => setConfigTarget(widget.i)}
              onConfigChange={(patch) =>
                setDocument((current) =>
                  updateWidgetConfig(current, widget.i, patch),
                )
              }
              onMoveDown={() => {
                const next = dashboard.widgets[index + 1];
                if (next) {
                  setDocument((current) =>
                    moveWidget(current, widget.i, next.i),
                  );
                }
              }}
              onMoveUp={() => {
                const previous = dashboard.widgets[index - 1];
                if (previous) {
                  setDocument((current) =>
                    moveWidget(current, widget.i, previous.i),
                  );
                }
              }}
              onRemove={() =>
                setDocument((current) => removeWidget(current, widget.i))
              }
              onResize={() => setSizeTarget(widget.i)}
              tileWidth={widgetWidthForViewport(
                widget.w,
                viewport.width,
              )}
              total={dashboard.widgets.length}
              widget={widget}
            />
          ))}
        </View>
      )}

      {renameOpen ? (
        <RenameDashboardModal
          currentName={dashboard.name}
          onClose={() => setRenameOpen(false)}
          onSave={(name) => {
            setDocument((current) =>
              renameDashboard(current, current.activeId, name),
            );
            setRenameOpen(false);
          }}
        />
      ) : null}
      <WidgetGallery
        onAdd={(definition) => {
          setDocument((current) => addWidget(current, definition));
          setGalleryOpen(false);
        }}
        onClose={() => setGalleryOpen(false)}
        open={galleryOpen}
        placedIds={dashboard.widgets.map((widget) => widget.d)}
      />
      <SizeModal
        definition={sizeWidget ? findWidget(sizeWidget.d) ?? null : null}
        onClose={() => setSizeTarget(null)}
        onResize={(size) => {
          if (sizeWidget) {
            setDocument((current) =>
              resizeWidget(current, sizeWidget.i, size),
            );
          }
          setSizeTarget(null);
        }}
        open={sizeWidget !== null}
        size={
          sizeWidget ? { h: sizeWidget.h, w: sizeWidget.w } : null
        }
      />
      <ConfigModal
        config={configWidget?.c ?? {}}
        definition={
          configWidget ? findWidget(configWidget.d) ?? null : null
        }
        onChange={(patch) => {
          if (configWidget) {
            setDocument((current) =>
              updateWidgetConfig(current, configWidget.i, patch),
            );
          }
        }}
        onClose={() => setConfigTarget(null)}
        open={configWidget !== null}
      />
    </Screen>
  );
}

function DashboardTabs({
  document,
  editing,
  onAdd,
  onRemove,
  onRename,
  onSelect,
}: {
  document: BoardDocument;
  editing: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: () => void;
  onSelect: (id: string) => void;
}) {
  const { locale } = useLocale();
  const { theme } = useAppTheme();
  return (
    <ScrollView
      contentContainerStyle={styles.tabs}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {document.dashboards.map((dashboard) => {
        const active = dashboard.id === document.activeId;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={dashboard.id}
            onPress={() => onSelect(dashboard.id)}
            style={[
              styles.tab,
              {
                backgroundColor: active
                  ? theme.palette.primary
                  : theme.palette.surface,
                borderColor: active
                  ? theme.palette.primary
                  : theme.palette.border,
              },
            ]}
          >
            <AppText
              style={{
                color: active
                  ? theme.palette.primaryForeground
                  : theme.palette.foreground,
              }}
              variant="label"
            >
              {dashboard.name}
            </AppText>
          </Pressable>
        );
      })}
      {editing ? (
        <>
          <Pressable
            accessibilityLabel={
              locale === 'ar' ? 'إعادة تسمية اللوحة' : 'Rename board'
            }
            accessibilityRole="button"
            onPress={onRename}
            style={styles.tabAction}
          >
            <Pencil color={theme.palette.foreground} size={18} />
          </Pressable>
          {document.dashboards.length > 1 ? (
            <Pressable
              accessibilityLabel={
                locale === 'ar' ? 'حذف اللوحة' : 'Delete board'
              }
              accessibilityRole="button"
              onPress={() => onRemove(document.activeId)}
              style={styles.tabAction}
            >
              <Trash2 color={theme.palette.danger} size={18} />
            </Pressable>
          ) : null}
          {document.dashboards.length < MAX_DASHBOARDS ? (
            <Pressable
              accessibilityLabel={
                locale === 'ar' ? 'لوحة جديدة' : 'New board'
              }
              accessibilityRole="button"
              onPress={onAdd}
              style={styles.tabAction}
            >
              <Plus color={theme.palette.foreground} size={20} />
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function BoardTile({
  editing,
  index,
  onConfig,
  onConfigChange,
  onMoveDown,
  onMoveUp,
  onRemove,
  onResize,
  tileWidth,
  total,
  widget,
}: {
  editing: boolean;
  index: number;
  onConfig: () => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onResize: () => void;
  tileWidth: number;
  total: number;
  widget: WidgetInstance;
}) {
  const { locale } = useLocale();
  const { theme } = useAppTheme();
  const definition = findWidget(widget.d);
  const name = definition
    ? locale === 'ar'
      ? definition.nameAr
      : definition.nameEn
    : widget.d;
  return (
    <View
      style={[
        styles.tile,
        {
          minHeight: Math.max(126, widget.h * 76),
          width: tileWidth,
        },
      ]}
    >
      {editing ? (
        <AppCard style={styles.tileControls}>
          <View style={styles.tileTitle}>
            <AppText style={styles.tileName} variant="label">
              {name}
            </AppText>
            <AppText color="muted" variant="caption">
              {widget.w} × {widget.h}
            </AppText>
          </View>
          <View style={styles.controlRow}>
            <Pressable
              accessibilityLabel={
                locale === 'ar'
                  ? `نقل ${name} للأعلى`
                  : `Move ${name} up`
              }
              disabled={index === 0}
              onPress={onMoveUp}
              style={[styles.control, { opacity: index === 0 ? 0.35 : 1 }]}
            >
              <ArrowUp color={theme.palette.foreground} size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel={
                locale === 'ar'
                  ? `نقل ${name} للأسفل`
                  : `Move ${name} down`
              }
              disabled={index === total - 1}
              onPress={onMoveDown}
              style={[
                styles.control,
                { opacity: index === total - 1 ? 0.35 : 1 },
              ]}
            >
              <ArrowDown color={theme.palette.foreground} size={18} />
            </Pressable>
            {definition ? (
              <Pressable
                accessibilityLabel={
                  locale === 'ar'
                    ? `تغيير حجم ${name}`
                    : `Resize ${name}`
                }
                onPress={onResize}
                style={styles.control}
              >
                <Maximize2 color={theme.palette.foreground} size={18} />
              </Pressable>
            ) : null}
            {definition && definition.fields.length > 0 ? (
              <Pressable
                accessibilityLabel={
                  locale === 'ar'
                    ? `إعدادات ${name}`
                    : `${name} settings`
                }
                onPress={onConfig}
                style={styles.control}
              >
                <Settings color={theme.palette.foreground} size={18} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={
                locale === 'ar' ? `حذف ${name}` : `Remove ${name}`
              }
              onPress={onRemove}
              style={styles.control}
            >
              <Trash2 color={theme.palette.danger} size={18} />
            </Pressable>
          </View>
        </AppCard>
      ) : null}
      <WidgetRenderer
        instance={widget}
        onConfigChange={onConfigChange}
      />
    </View>
  );
}

function RenameDashboardModal({
  currentName,
  onClose,
  onSave,
}: {
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const { locale } = useLocale();
  const [name, setName] = useState(currentName);
  return (
    <BoardModal
      onClose={onClose}
      open
      title={locale === 'ar' ? 'إعادة تسمية اللوحة' : 'Rename board'}
    >
      <AppInput
        maxLength={40}
        onChangeText={setName}
        testID="board-dashboard-name"
        value={name}
      />
      <AppButton onPress={() => onSave(name)}>
        {locale === 'ar' ? 'حفظ' : 'Save'}
      </AppButton>
    </BoardModal>
  );
}

function WidgetGallery({
  onAdd,
  onClose,
  open,
  placedIds,
}: {
  onAdd: (definition: WidgetDefinition) => void;
  onClose: () => void;
  open: boolean;
  placedIds: readonly string[];
}) {
  const { locale } = useLocale();
  const { theme } = useAppTheme();
  return (
    <BoardModal
      onClose={onClose}
      open={open}
      title={locale === 'ar' ? 'إضافة ويدجت' : 'Add widget'}
    >
      {WIDGETS.map((definition) => {
        const disabled =
          !definition.multiple && placedIds.includes(definition.id);
        const Icon = definition.icon;
        return (
          <AppCard key={definition.id} style={styles.galleryItem}>
            <Icon color={theme.palette.primary} size={22} />
            <View style={styles.galleryCopy}>
              <AppText variant="label">
                {locale === 'ar'
                  ? definition.nameAr
                  : definition.nameEn}
              </AppText>
              <AppText color="muted" variant="caption">
                {locale === 'ar'
                  ? definition.descriptionAr
                  : definition.descriptionEn}
              </AppText>
            </View>
            <AppButton
              disabled={disabled}
              onPress={() => onAdd(definition)}
              testID={`board-add-${definition.id}`}
              variant="secondary"
            >
              {disabled
                ? locale === 'ar'
                  ? 'مضاف'
                  : 'Added'
                : locale === 'ar'
                  ? 'إضافة'
                  : 'Add'}
            </AppButton>
          </AppCard>
        );
      })}
    </BoardModal>
  );
}

const widthOptions = [
  { labelAr: 'ربع', labelEn: 'Quarter', value: 3 },
  { labelAr: 'ثلث', labelEn: 'Third', value: 4 },
  { labelAr: 'نصف', labelEn: 'Half', value: 6 },
  { labelAr: 'كامل', labelEn: 'Full', value: 12 },
] as const;
const heightOptions = [
  { labelAr: 'قصير', labelEn: 'Short', value: 1 },
  { labelAr: 'متوسط', labelEn: 'Medium', value: 2 },
  { labelAr: 'طويل', labelEn: 'Tall', value: 4 },
  { labelAr: 'ممتد', labelEn: 'Extended', value: 6 },
  { labelAr: 'كبير', labelEn: 'Large', value: 8 },
] as const;

function SizeModal({
  definition,
  onClose,
  onResize,
  open,
  size,
}: {
  definition: WidgetDefinition | null;
  onClose: () => void;
  onResize: (size: WidgetSize) => void;
  open: boolean;
  size: WidgetSize | null;
}) {
  const { locale } = useLocale();
  if (!definition || !size) {
    return null;
  }
  return (
    <BoardModal
      onClose={onClose}
      open={open}
      title={locale === 'ar' ? 'حجم الويدجت' : 'Widget size'}
    >
      <AppText variant="label">
        {locale === 'ar' ? 'العرض' : 'Width'}
      </AppText>
      <View style={styles.choiceGrid}>
        {widthOptions
          .filter(
            (option) =>
              option.value >= definition.minSize.w &&
              option.value <= definition.maxSize.w,
          )
          .map((option) => (
            <Choice
              active={size.w === option.value}
              key={option.value}
              label={locale === 'ar' ? option.labelAr : option.labelEn}
              onPress={() => onResize({ ...size, w: option.value })}
            />
          ))}
      </View>
      <AppText variant="label">
        {locale === 'ar' ? 'الارتفاع' : 'Height'}
      </AppText>
      <View style={styles.choiceGrid}>
        {heightOptions
          .filter(
            (option) =>
              option.value >= definition.minSize.h &&
              option.value <= definition.maxSize.h,
          )
          .map((option) => (
            <Choice
              active={size.h === option.value}
              key={option.value}
              label={locale === 'ar' ? option.labelAr : option.labelEn}
              onPress={() => onResize({ ...size, h: option.value })}
            />
          ))}
      </View>
      <AppButton onPress={onClose} variant="secondary">
        {locale === 'ar' ? 'إغلاق' : 'Close'}
      </AppButton>
    </BoardModal>
  );
}

function ConfigModal({
  config,
  definition,
  onChange,
  onClose,
  open,
}: {
  config: Record<string, unknown>;
  definition: WidgetDefinition | null;
  onChange: (patch: Record<string, unknown>) => void;
  onClose: () => void;
  open: boolean;
}) {
  const { locale } = useLocale();
  if (!definition) {
    return null;
  }
  return (
    <BoardModal
      onClose={onClose}
      open={open}
      title={`${locale === 'ar' ? 'إعدادات' : 'Settings'} ${locale === 'ar' ? definition.nameAr : definition.nameEn}`}
    >
      {definition.fields.map((field) => (
        <ConfigField
          field={field}
          key={field.key}
          onChange={(value) => onChange({ [field.key]: value })}
          value={config[field.key] ?? field.default}
        />
      ))}
      <AppButton onPress={onClose} variant="secondary">
        {locale === 'ar' ? 'إغلاق' : 'Close'}
      </AppButton>
    </BoardModal>
  );
}

function ConfigField({
  field,
  onChange,
  value,
}: {
  field: WidgetConfigField;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const { locale } = useLocale();
  const label = locale === 'ar' ? field.labelAr : field.labelEn;
  if (field.type === 'switch') {
    return (
      <View style={styles.switchRow}>
        <AppText>{label}</AppText>
        <Switch onValueChange={onChange} value={Boolean(value)} />
      </View>
    );
  }
  if (field.type === 'select') {
    return (
      <View style={styles.field}>
        <AppText variant="label">{label}</AppText>
        <View style={styles.choiceGrid}>
          {field.options.map((option) => (
            <Choice
              active={value === option.value}
              key={option.value}
              label={locale === 'ar' ? option.labelAr : option.labelEn}
              onPress={() => onChange(option.value)}
            />
          ))}
        </View>
      </View>
    );
  }
  if (field.type === 'number') {
    return (
      <NumberField
        field={field}
        label={label}
        onChange={onChange}
        value={value}
      />
    );
  }
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <AppInput
        maxLength={field.maxLength}
        onChangeText={onChange}
        testID={`board-config-${field.key}`}
        value={String(value)}
      />
    </View>
  );
}

// The website clamps a number only where the widget reads it, never while the
// user types. Clamping every keystroke makes 15 untypable in a 3 to 20 range
// and rewrites a cleared field, so the draft stays text until it is in range
// or the field is left.
function NumberField({
  field,
  label,
  onChange,
  value,
}: {
  field: Extract<WidgetConfigField, { type: 'number' }>;
  label: string;
  onChange: (value: number) => void;
  value: unknown;
}) {
  const committed = typeof value === 'number' ? value : field.default;
  const [draft, setDraft] = useState(() => String(committed));
  const min = field.min ?? Number.NEGATIVE_INFINITY;
  const max = field.max ?? Number.POSITIVE_INFINITY;

  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <AppInput
        keyboardType="number-pad"
        onBlur={() => {
          const parsed = Number(draft);
          if (draft.trim() === '' || !Number.isFinite(parsed)) {
            setDraft(String(committed));
            return;
          }
          const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
          setDraft(String(clamped));
          if (clamped !== committed) {
            onChange(clamped);
          }
        }}
        onChangeText={(raw) => {
          setDraft(raw);
          const parsed = Number(raw);
          if (
            raw.trim() !== '' &&
            Number.isInteger(parsed) &&
            parsed >= min &&
            parsed <= max
          ) {
            onChange(parsed);
          }
        }}
        testID={`board-config-${field.key}`}
        value={draft}
      />
    </View>
  );
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: active
            ? theme.palette.primary
            : theme.palette.surfaceRaised,
          borderColor: active
            ? theme.palette.primary
            : theme.palette.border,
        },
      ]}
    >
      <AppText
        style={{
          color: active
            ? theme.palette.primaryForeground
            : theme.palette.foreground,
        }}
        variant="caption"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function BoardModal({
  children,
  onClose,
  open,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const { theme } = useAppTheme();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={open}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: theme.palette.background,
              borderColor: theme.palette.border,
            },
          ]}
        >
          <AppText variant="heading">{title}</AppText>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  boardGrid: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  choice: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  control: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  empty: {
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
  },
  field: {
    gap: 8,
  },
  galleryCopy: {
    flex: 1,
    gap: 2,
  },
  galleryItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    gap: 14,
    paddingBottom: 24,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 16,
    maxHeight: '88%',
    padding: 18,
  },
  notice: {
    gap: 10,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabAction: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tabs: {
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    gap: 8,
  },
  tileControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tileName: {
    flex: 1,
  },
  tileTitle: {
    flex: 1,
    gap: 2,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Board/Index.tsx (127 lines)
  confidence: high
  todos:      0
  notes:      The native Board screen preserves dashboard selection, editing, gallery access, and synchronized state.
              Storage is account scoped, so the first sign-in promotes the guest board the way the shared web slot does.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/BoardGrid.tsx (102 lines)
  confidence: high
  todos:      0
  notes:      The native Board screen owns the responsive tile grid and edit layout controls.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/BoardTile.tsx (155 lines)
  confidence: high
  todos:      0
  notes:      The native Board tile preserves sizing, editing, configuration, removal, and widget rendering.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/BoardToolbar.tsx (47 lines)
  confidence: high
  todos:      0
  notes:      The native toolbar preserves edit, widget gallery, synchronization, and recovery actions.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/DashboardTabs.tsx (104 lines)
  confidence: high
  todos:      0
  notes:      Native dashboard tabs preserve selection, creation, rename, and removal behavior.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/SizeMenu.tsx (74 lines)
  confidence: high
  todos:      0
  notes:      The native size modal exposes only sizes allowed by each widget definition and current layout.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/TileChrome.tsx (14 lines)
  confidence: high
  todos:      0
  notes:      BoardTile owns the native edit chrome and scoped tile actions.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/WidgetConfigDialog.tsx (105 lines)
  confidence: high
  todos:      0
  notes:      The native configuration modal renders typed fields and persists widget configuration patches.
              Number fields keep a text draft and clamp on blur, since a phone keyboard has no spinner.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/WidgetGallery.tsx (70 lines)
  confidence: high
  todos:      0
  notes:      The native widget gallery filters registered widgets and enforces single-instance definitions.
*/
