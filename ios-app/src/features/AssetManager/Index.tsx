import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { api } from '../../api';
import {
  AdaptivePanes,
  contentStyle,
  FormField,
  Heading,
  Label,
  SearchField,
  Section,
} from '../../components';
import { useAccount } from '../../platform/account';
import { documentFormData, pickDocument, type SelectedDocument } from '../../platform/documents';
import { useFeatureNavigation } from '../../platform/features';
import { previewFile, shareFile, shareZipFiles } from '../../platform/files';
import { useScreenActive } from '../../platform/lifecycle';
import { pickImage } from '../../platform/uploads';
import { record, text } from '../../platform/validation';
import { NativeAction, NativeIconAction, NativePicker, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import {
  assetFolders,
  assetIsImage,
  assetMatches,
  decodeAssetPage,
  formatBytes,
  mergeAssetPage,
  type AssetPage,
  type ManagedAsset,
} from './model';
export function AssetManagerScreen(): React.JSX.Element {
  const account = useAccount();
  return <AssetPanel key={JSON.stringify([account.sessionGeneration, account.user?.effective_permissions])} />;
}
function AssetThumbnail({ file }: { file: ManagedAsset }): React.JSX.Element {
  const [broken, setBroken] = useState(false);
  return assetIsImage(file.filename) && !broken ? (
    <Image
      source={{ uri: file.url }}
      onError={() => setBroken(true)}
      contentFit="cover"
      style={{ width: 48, height: 48, borderRadius: 8 }}
    />
  ) : (
    <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Label>ملف</Label>
    </View>
  );
}
function AssetPanel(): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    active = useScreenActive(),
    { colors } = useTheme(),
    stamp = account.sessionGeneration,
    allowed = account.user?.effective_permissions.includes('assets.manage') === true;
  const [page, setPage] = useState<AssetPage | null>(null),
    [tab, setTab] = useState('files'),
    [query, setQuery] = useState(''),
    [folderFilter, setFolderFilter] = useState(''),
    [folder, setFolder] = useState('downloads'),
    [file, setFile] = useState<SelectedDocument | null>(null),
    [uploaded, setUploaded] = useState<string | null>(null),
    [copied, setCopied] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const listRequest = useRef<AbortController | null>(null),
    lock = useRef(false),
    copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(
    async (cursor: string | null = null, refresh = false): Promise<void> => {
      if (!allowed) return;
      if (listRequest.current) {
        if (!refresh) return;
        listRequest.current.abort();
      }
      const controller = new AbortController();
      listRequest.current = controller;
      if (cursor) setMore(true);
      else {
        setLoading(true);
        setPage(null);
      }
      setError(null);
      try {
        const next = await api.request('admin/assets/list', decodeAssetPage, {
          signal: controller.signal,
          authenticated: true,
          sessionGeneration: stamp,
          params: cursor ? { cursor } : refresh ? { refresh: 1 } : {},
        });
        if (controller.signal.aborted) return;
        if (cursor && next.hasMore && next.cursor === cursor)
          throw new Error('لم يتقدم مؤشر الملفات. حدّث القائمة وأعد المحاولة.');
        setPage((value) => mergeAssetPage(cursor ? value : null, next));
      } catch (reason) {
        if (!controller.signal.aborted && api.getSessionGeneration() === stamp)
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل الملفات.');
      } finally {
        if (listRequest.current === controller) {
          listRequest.current = null;
          setLoading(false);
          setMore(false);
        }
      }
    },
    [allowed, stamp],
  );
  useEffect(() => {
    if (active && allowed) void load();
    return () => {
      listRequest.current?.abort();
      listRequest.current = null;
    };
  }, [active, allowed, load]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  async function perform(work: () => Promise<void>): Promise<void> {
    if (lock.current || account.busy) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (reason) {
      if (api.getSessionGeneration() === stamp)
        setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية.');
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  }
  function copy(url: string): void {
    void perform(async () => {
      await Clipboard.setStringAsync(url);
      if (api.getSessionGeneration() !== stamp) return;
      setCopied(url);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    });
  }
  function choose(photo = false): void {
    void perform(async () => {
      const selected = photo ? await pickImage({ maxBytes: 50 * 1024 * 1024 }) : await pickDocument();
      if (!selected || api.getSessionGeneration() !== stamp) return;
      setFile(
        'name' in selected
          ? selected
          : {
              uri: selected.uri,
              name: selected.fileName ?? 'image.jpg',
              size: new File(selected.uri).size,
              ...(selected.mimeType ? { mimeType: selected.mimeType } : {}),
            },
      );
      setUploaded(null);
    });
  }
  function upload(): void {
    if (!file) return;
    void perform(async () => {
      if (folder.length > 50) throw new Error('اسم المجلد حتى ٥٠ حرفاً.');
      const body = documentFormData('file', file);
      body.append('folder', folder);
      const url = await api.request(
        'admin/assets/upload',
        (value) => {
          const row = record(value);
          if (row.success !== true) throw new Error('لم يتم تأكيد رفع الملف.');
          const confirmedUrl = new URL(text(row.url));
          if (confirmedUrl.protocol !== 'https:' || confirmedUrl.username || confirmedUrl.password)
            throw new Error('رابط الملف غير صالح.');
          return confirmedUrl.toString();
        },
        { method: 'POST', authenticated: true, sessionGeneration: stamp, body },
      );
      if (api.getSessionGeneration() !== stamp) return;
      setUploaded(url);
      setFile(null);
      setMessage('تم رفع الملف بنجاح.');
      await load(null, true);
    });
  }
  function remove(asset: ManagedAsset): void {
    Alert.alert('حذف الملف نهائياً؟', asset.path, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          void perform(async () => {
            await api.request(
              'admin/assets/delete',
              (value) => {
                if (record(value).success !== true) throw new Error('لم يتم تأكيد الحذف.');
              },
              { method: 'DELETE', authenticated: true, sessionGeneration: stamp, body: { path: asset.path } },
            );
            if (api.getSessionGeneration() !== stamp) return;
            setPage((value) =>
              value
                ? {
                    ...value,
                    files: value.files.filter((item) => item.path !== asset.path),
                    totalSize: Math.max(0, value.totalSize - asset.size),
                  }
                : null,
            );
            setMessage('تم حذف الملف.');
          });
        },
      },
    ]);
  }
  function backup(): void {
    const files = page?.files;
    if (!files?.length) return;
    void perform(async () => {
      setProgress(0);
      const result = await shareZipFiles(
        files.map((item) => ({ url: item.url, filename: item.path })),
        `r2-assets-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        { preservePaths: true, allowPartial: true, onProgress: setProgress },
      );
      if (api.getSessionGeneration() !== stamp) return;
      setMessage(
        result.failed.length
          ? `الأرشيف جزئي: تم تجهيز ${result.completed} ملفاً وتعذر ${result.failed.length}.\n${result.failed.join('\n')}`
          : `تم تجهيز ${result.completed} ملفاً للمشاركة أو الحفظ في تطبيق الملفات.`,
      );
    });
  }
  const files = page?.files ?? [],
    filtered = files.filter((item) => assetMatches(item, query, folderFilter)),
    disabled = busy || account.busy;
  return (
    <AdaptivePanes
      primary={
        <FlatList
          data={allowed && tab === 'files' ? filtered : []}
          keyExtractor={(item) => item.path}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Heading>إدارة الملفات المستضافة</Heading>
              {!allowed ? (
                <Section>
                  <Label>تحتاج صلاحية إدارة الملفات.</Label>
                  <NativeAction title="الحساب" onPress={() => navigation.open('account')} />
                </Section>
              ) : (
                <>
                  <NativeSegmented
                    options={[
                      { value: 'files', label: 'الملفات' },
                      { value: 'upload', label: 'رفع ملف' },
                    ]}
                    value={tab}
                    onChange={setTab}
                    disabled={disabled}
                  />
                  {tab === 'files' ? (
                    <Section>
                      <Label>
                        {files.length} ملف محمّل، الحجم {formatBytes(page?.totalSize ?? 0)}.
                      </Label>
                      <Label secondary>
                        البحث والمجلدات والنسخة ZIP تشمل الملفات المحمّلة حالياً. حمّل المزيد لإضافتها إلى
                        المجموعة.
                      </Label>
                      <SearchField
                        value={query}
                        onChange={setQuery}
                        placeholder="البحث باسم الملف أو المسار"
                      />
                      <NativePicker
                        label="المجلد"
                        value={folderFilter}
                        options={assetFolders(files)}
                        onChange={setFolderFilter}
                      />
                      <Label secondary>
                        عرض {filtered.length} من {files.length} ملف.
                      </Label>
                      <NativeAction
                        title="تحديث الملفات"
                        disabled={disabled || loading || more}
                        onPress={() => {
                          void load(null, true);
                        }}
                      />
                      <NativeAction
                        title="تنزيل الملفات المحمّلة ZIP"
                        systemImage="archivebox"
                        disabled={disabled || !files.length}
                        onPress={backup}
                      />
                      {progress !== null ? <Label>تجهيز الأرشيف: {progress}٪</Label> : null}
                    </Section>
                  ) : (
                    <Section>
                      <Label secondary>رفع أي نوع من الملفات حتى ٥٠ ميغابايت والحصول على رابط مباشر.</Label>
                      <FormField
                        label="مجلد الحفظ"
                        value={folder}
                        maxLength={50}
                        disabled={disabled}
                        onChange={setFolder}
                      />
                      <NativeAction
                        title="اختيار ملف من تطبيق الملفات"
                        systemImage="doc"
                        disabled={disabled}
                        onPress={() => choose()}
                      />
                      <NativeAction
                        title="اختيار صورة"
                        systemImage="photo"
                        disabled={disabled}
                        onPress={() => choose(true)}
                      />
                      {file ? (
                        <Label>
                          الملف المحدد: {file.name} ({formatBytes(file.size)})
                        </Label>
                      ) : null}
                      <NativeAction
                        title={busy ? 'جارٍ الرفع' : 'بدء الرفع'}
                        prominent
                        disabled={disabled || !file}
                        onPress={upload}
                      />
                      {uploaded ? (
                        <>
                          <Label>الرابط المباشر: {uploaded}</Label>
                          <NativeAction
                            title={copied === uploaded ? 'تم نسخ الرابط' : 'نسخ الرابط'}
                            disabled={disabled}
                            onPress={() => copy(uploaded)}
                          />
                        </>
                      ) : null}
                    </Section>
                  )}
                  {loading ? (
                    <ActivityIndicator
                      color={colors.accent}
                      accessibilityLabel="جارٍ تحميل ملفات الصفحة الأولى"
                    />
                  ) : null}
                  {error ? (
                    <Section>
                      <Label style={{ color: colors.danger }}>{error}</Label>
                      {!page && tab === 'files' ? (
                        <NativeAction
                          title="إعادة المحاولة"
                          disabled={loading}
                          onPress={() => {
                            void load();
                          }}
                        />
                      ) : null}
                    </Section>
                  ) : null}
                  {message ? (
                    <Section>
                      <Label>{message}</Label>
                    </Section>
                  ) : null}
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Section>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AssetThumbnail file={item} />
                <View style={{ flex: 1 }}>
                  <Label style={{ fontWeight: '700' }}>{item.filename}</Label>
                  <Label secondary>
                    {formatBytes(item.size)}، {item.folder}
                  </Label>
                </View>
              </View>
              <Label secondary>{item.path}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <NativeAction
                  title="معاينة"
                  style={{ flex: 1, minWidth: 100 }}
                  disabled={disabled}
                  onPress={() => {
                    void perform(() => previewFile({ url: item.url, filename: item.filename }));
                  }}
                />
                <NativeIconAction
                  title={copied === item.url ? 'تم نسخ الرابط' : 'نسخ الرابط المباشر'}
                  systemImage={copied === item.url ? 'checkmark' : 'doc.on.doc'}
                  disabled={disabled}
                  onPress={() => copy(item.url)}
                />
                <NativeIconAction
                  title="تنزيل أو حفظ في الملفات"
                  systemImage="square.and.arrow.down"
                  disabled={disabled}
                  onPress={() => {
                    void perform(() =>
                      shareFile({
                        url: item.url,
                        filename: item.filename,
                        mimeType: 'application/octet-stream',
                      }),
                    );
                  }}
                />
                <NativeAction
                  title="حذف"
                  systemImage="trash"
                  style={{ minWidth: 88 }}
                  destructive
                  disabled={disabled}
                  onPress={() => remove(item)}
                />
              </View>
            </Section>
          )}
          ListEmptyComponent={
            <View>
              {allowed && tab === 'files' && !loading && page ? (
                <Label secondary>لا توجد ملفات مطابقة للبحث.</Label>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View>
              {allowed && tab === 'files' && page ? (
                <View style={{ gap: 12 }}>
                  {page.hasMore ? (
                    <NativeAction
                      title={more ? 'جارٍ تحميل المزيد' : `تحميل المزيد (${files.length} محمّل حتى الآن)`}
                      disabled={more || disabled || loading}
                      onPress={() => {
                        if (page.cursor) void load(page.cursor);
                      }}
                    />
                  ) : files.length ? (
                    <Label secondary>تم تحميل جميع الملفات ({files.length}).</Label>
                  ) : null}
                </View>
              ) : null}
            </View>
          }
        />
      }
    />
  );
}
export default AssetManagerScreen;

// PORT STATUS: source Admin/AssetManager/Index.tsx; confidence medium; todos 3 native picker/QuickLook/partial ZIP proof, guarded alias rollout and authenticated non-production mutation proof.
