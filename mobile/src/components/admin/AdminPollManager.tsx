import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Edit2,
  ImagePlus,
  Plus,
  Save,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { resolvePollImageUrl } from '@/features/Polls/sharing';

import {
  archiveAdminCandidate,
  createAdminCandidate,
  createAdminGroup,
  deleteAdminCandidate,
  deleteAdminGroup,
  type AdminCandidate,
  type AdminGroup,
  type AdminPollDetail,
  reorderAdminGroups,
  restoreAdminCandidate,
  setDefaultAdminGroup,
  uploadAdminCandidateImage,
  updateAdminCandidate,
} from './api';
import {
  candidateSuccessors,
  type CandidateStatusFilter,
  filterCandidates,
  isoDate,
  moveGroup,
} from './model';

interface AdminPollManagerProps {
  initialData: AdminPollDetail;
  onRefresh: () => void | Promise<unknown>;
  pollId: string;
}

interface CandidateForm {
  groupId: string | null;
  imageUrl: string;
  name: string;
  title: string;
}

interface ArchiveForm {
  reason: string;
  successorId: string | null;
  termEndedAt: string;
}

const emptyCandidateForm: CandidateForm = {
  groupId: null,
  imageUrl: '',
  name: '',
  title: '',
};

const statusLabels: Record<CandidateStatusFilter, string> = {
  active: 'الحاليون',
  all: 'الكل',
  archived: 'السابقون',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length <= 300
    ? error.message
    : fallback;
}

export default function AdminPollManager({
  initialData,
  onRefresh,
  pollId,
}: AdminPollManagerProps) {
  const { theme } = useAppTheme();
  const [groups, setGroups] = useState<AdminGroup[]>(initialData.groups);
  const [candidates, setCandidates] = useState<AdminCandidate[]>(
    initialData.candidates,
  );
  const [activeGroupId, setActiveGroupId] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] =
    useState<CandidateStatusFilter>('active');
  const [newGroupName, setNewGroupName] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] =
    useState<AdminCandidate | null>(null);
  const [candidateForm, setCandidateForm] =
    useState<CandidateForm>(emptyCandidateForm);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [archiveTarget, setArchiveTarget] =
    useState<AdminCandidate | null>(null);
  const [archiveForm, setArchiveForm] = useState<ArchiveForm>({
    reason: '',
    successorId: null,
    termEndedAt: '',
  });
  const orderedGroups = [...groups].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const displayedCandidates = filterCandidates(
    candidates,
    activeGroupId,
    statusFilter,
  );
  const successors = candidateSuccessors(candidates, archiveTarget);
  const candidatePreviewUrl = resolvePollImageUrl(candidateForm.imageUrl);

  const refresh = () => {
    void onRefresh();
  };

  const addGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      return;
    }
    setBusyAction('group-add');
    setError(null);
    try {
      const group = await createAdminGroup(pollId, name);
      setGroups((current) => [...current, group]);
      setNewGroupName('');
      refresh();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذرت إضافة المجموعة.'));
    } finally {
      setBusyAction(null);
    }
  };

  const removeGroup = (id: string) => {
    Alert.alert(
      'حذف المجموعة؟',
      'سيتم إلغاء تعيين مرشحي المجموعة دون حذفهم.',
      [
        { style: 'cancel', text: 'إلغاء' },
        {
          onPress: () => {
            setBusyAction(`group-delete-${id}`);
            setError(null);
            void deleteAdminGroup(id)
              .then(() => {
                setGroups((current) =>
                  current.filter((group) => group.id !== id),
                );
                setCandidates((current) =>
                  current.map((candidate) =>
                    candidate.groupId === id
                      ? { ...candidate, groupId: null }
                      : candidate,
                  ),
                );
                if (activeGroupId === id) {
                  setActiveGroupId('all');
                }
                refresh();
              })
              .catch((cause: unknown) =>
                setError(errorMessage(cause, 'تعذر حذف المجموعة.')),
              )
              .finally(() => setBusyAction(null));
          },
          style: 'destructive',
          text: 'حذف',
        },
      ],
    );
  };

  const setDefaultGroup = async (id: string) => {
    setBusyAction(`group-default-${id}`);
    setError(null);
    try {
      const selected = await setDefaultAdminGroup(id);
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          isDefault: group.id === selected.id,
        })),
      );
      refresh();
    } catch (cause) {
      setError(errorMessage(cause, 'فشل تعيين المجموعة الافتراضية.'));
    } finally {
      setBusyAction(null);
    }
  };

  const shiftGroup = async (direction: 'left' | 'right') => {
    if (activeGroupId === 'all') {
      return;
    }
    const previous = groups;
    const moved = moveGroup(groups, activeGroupId, direction);
    if (moved.every((group, index) => group.id === orderedGroups[index]?.id)) {
      return;
    }
    setGroups(moved);
    setBusyAction('group-reorder');
    setError(null);
    try {
      setGroups(await reorderAdminGroups(moved));
    } catch (cause) {
      setGroups(previous);
      setError(errorMessage(cause, 'فشل إعادة ترتيب المجموعات.'));
      refresh();
    } finally {
      setBusyAction(null);
    }
  };

  const openAddCandidate = () => {
    setEditingCandidate(null);
    setCandidateForm({
      ...emptyCandidateForm,
      groupId: activeGroupId === 'all' ? null : activeGroupId,
    });
    setCandidateModalOpen(true);
    setError(null);
  };

  const openEditCandidate = (candidate: AdminCandidate) => {
    setEditingCandidate(candidate);
    setCandidateForm({
      groupId: candidate.groupId,
      imageUrl: candidate.imageUrl ?? '',
      name: candidate.name,
      title: candidate.title ?? '',
    });
    setCandidateModalOpen(true);
    setError(null);
  };

  const pickCandidateImage = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('يلزم السماح بالوصول إلى الصور لاختيار صورة المرشح.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ['images'],
      quality: 0.9,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) {
      return;
    }
    if (asset.fileSize && asset.fileSize > 4 * 1_024 * 1_024) {
      setError('يجب ألا يتجاوز حجم الصورة 4 MB.');
      return;
    }
    setUploading(true);
    try {
      const imageUrl = await uploadAdminCandidateImage(
        asset.uri,
        asset.fileName ?? 'candidate-image.jpg',
      );
      setCandidateForm((current) => ({ ...current, imageUrl }));
    } catch (cause) {
      setError(errorMessage(cause, 'تعذر رفع الصورة.'));
    } finally {
      setUploading(false);
    }
  };

  const saveCandidate = async () => {
    const name = candidateForm.name.trim();
    if (!name) {
      setError('اسم المرشح مطلوب.');
      return;
    }
    const rawImageUrl = candidateForm.imageUrl.trim();
    if (rawImageUrl && !resolvePollImageUrl(rawImageUrl)) {
      setError('رابط الصورة غير صالح.');
      return;
    }
    setBusyAction('candidate-save');
    setError(null);
    const payload = {
      groupId: candidateForm.groupId,
      imageUrl: rawImageUrl || null,
      name,
      title: candidateForm.title.trim() || null,
    };
    try {
      const saved = editingCandidate
        ? await updateAdminCandidate(editingCandidate.id, payload)
        : await createAdminCandidate({ ...payload, pollId });
      setCandidates((current) =>
        editingCandidate
          ? current.map((candidate) =>
              candidate.id === saved.id ? saved : candidate,
            )
          : [...current, saved],
      );
      setCandidateModalOpen(false);
      refresh();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذر حفظ المرشح.'));
    } finally {
      setBusyAction(null);
    }
  };

  const removeCandidate = (candidate: AdminCandidate) => {
    Alert.alert(
      'حذف المرشح؟',
      `هل تريد حذف ${candidate.name} نهائيًا؟`,
      [
        { style: 'cancel', text: 'إلغاء' },
        {
          onPress: () => {
            setBusyAction(`candidate-delete-${candidate.id}`);
            setError(null);
            void deleteAdminCandidate(candidate.id)
              .then(() => {
                setCandidates((current) =>
                  current.filter((item) => item.id !== candidate.id),
                );
                refresh();
              })
              .catch((cause: unknown) =>
                setError(errorMessage(cause, 'تعذر حذف المرشح.')),
              )
              .finally(() => setBusyAction(null));
          },
          style: 'destructive',
          text: 'حذف',
        },
      ],
    );
  };

  const openArchive = (candidate: AdminCandidate) => {
    setArchiveTarget(candidate);
    setArchiveForm({
      reason: '',
      successorId: null,
      termEndedAt: isoDate(new Date()),
    });
    setError(null);
  };

  const submitArchive = async () => {
    if (!archiveTarget) {
      return;
    }
    setBusyAction('candidate-archive');
    setError(null);
    try {
      const archived = await archiveAdminCandidate(archiveTarget.id, {
        archiveReason: archiveForm.reason.trim() || null,
        successorId: archiveForm.successorId,
        termEndedAt: archiveForm.termEndedAt || null,
      });
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id === archived.id ? archived : candidate,
        ),
      );
      setArchiveTarget(null);
      refresh();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذرت أرشفة المرشح.'));
    } finally {
      setBusyAction(null);
    }
  };

  const restoreCandidate = (candidate: AdminCandidate) => {
    Alert.alert(
      'إعادة التفعيل؟',
      `هل تريد إعادة تفعيل ${candidate.name}؟`,
      [
        { style: 'cancel', text: 'إلغاء' },
        {
          onPress: () => {
            setBusyAction(`candidate-restore-${candidate.id}`);
            setError(null);
            void restoreAdminCandidate(candidate.id)
              .then((restored) => {
                setCandidates((current) =>
                  current.map((item) =>
                    item.id === restored.id ? restored : item,
                  ),
                );
                refresh();
              })
              .catch((cause: unknown) =>
                setError(errorMessage(cause, 'تعذرت إعادة تفعيل المرشح.')),
              )
              .finally(() => setBusyAction(null));
          },
          text: 'إعادة التفعيل',
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {error ? (
        <AppCard style={{ borderColor: theme.palette.danger }}>
          <AppText color="danger">{error}</AppText>
        </AppCard>
      ) : null}

      <View style={styles.tabs}>
        <AppButton
          onPress={() => setActiveGroupId('all')}
          variant={activeGroupId === 'all' ? 'primary' : 'secondary'}
        >
          جميع المرشحين ({candidates.length.toLocaleString('ar-SY')})
        </AppButton>
        {orderedGroups.map((group) => (
          <AppButton
            key={group.id}
            onPress={() => setActiveGroupId(group.id)}
            variant={activeGroupId === group.id ? 'primary' : 'secondary'}
          >
            {group.name} ({candidates.filter((candidate) => candidate.groupId === group.id).length.toLocaleString('ar-SY')})
          </AppButton>
        ))}
      </View>

      <AppCard style={styles.groupCreator}>
        <AppInput
          onChangeText={setNewGroupName}
          placeholder="اسم مجموعة جديدة"
          style={styles.grow}
          value={newGroupName}
        />
        <AppButton
          disabled={!newGroupName.trim()}
          icon={<Plus color={theme.palette.primaryForeground} size={18} />}
          loading={busyAction === 'group-add'}
          onPress={() => void addGroup()}
        >
          إضافة مجموعة
        </AppButton>
      </AppCard>

      {activeGroupId !== 'all' ? (
        <AppCard style={styles.groupActions}>
          <AppText style={styles.grow} variant="heading">
            {groups.find((group) => group.id === activeGroupId)?.name}
          </AppText>
          <AppButton
            icon={
              <Star
                color={theme.palette.foreground}
                fill={
                  groups.find((group) => group.id === activeGroupId)?.isDefault
                    ? '#facc15'
                    : 'transparent'
                }
                size={18}
              />
            }
            loading={busyAction === `group-default-${activeGroupId}`}
            onPress={() => void setDefaultGroup(activeGroupId)}
            variant="ghost"
          >
            افتراضية
          </AppButton>
          <AppButton
            disabled={busyAction === 'group-reorder'}
            icon={<ArrowRight color={theme.palette.foreground} size={18} />}
            onPress={() => void shiftGroup('left')}
            variant="ghost"
          >
            يمين
          </AppButton>
          <AppButton
            disabled={busyAction === 'group-reorder'}
            icon={<ArrowLeft color={theme.palette.foreground} size={18} />}
            onPress={() => void shiftGroup('right')}
            variant="ghost"
          >
            يسار
          </AppButton>
          <AppButton
            disabled={busyAction === `group-delete-${activeGroupId}`}
            icon={<Trash2 color={theme.palette.danger} size={18} />}
            onPress={() => removeGroup(activeGroupId)}
            variant="danger"
          >
            حذف
          </AppButton>
        </AppCard>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.tabs}>
          {(Object.keys(statusLabels) as CandidateStatusFilter[]).map(
            (status) => (
              <AppButton
                key={status}
                onPress={() => setStatusFilter(status)}
                variant={statusFilter === status ? 'primary' : 'secondary'}
              >
                {statusLabels[status]}
              </AppButton>
            ),
          )}
        </View>
        <AppButton
          icon={<Plus color={theme.palette.primaryForeground} size={18} />}
          onPress={openAddCandidate}
        >
          إضافة مرشح
        </AppButton>
      </View>

      {displayedCandidates.length === 0 ? (
        <AppCard>
          <AppText color="muted">لا يوجد مرشحون مطابقون.</AppText>
        </AppCard>
      ) : (
        displayedCandidates.map((candidate) => {
          const archived = candidate.status === 'archived';
          const imageUrl = resolvePollImageUrl(candidate.imageUrl);
          const successorName = candidate.successorId
            ? candidates.find((item) => item.id === candidate.successorId)?.name
            : null;
          return (
            <AppCard
              key={candidate.id}
              style={[styles.candidateCard, archived ? styles.archived : null]}
            >
              {imageUrl ? (
                <Image
                  accessibilityLabel={candidate.name}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: imageUrl }}
                  style={styles.candidateImage}
                />
              ) : (
                <View
                  style={[
                    styles.candidateImage,
                    styles.imageFallback,
                    { backgroundColor: theme.palette.surfaceRaised },
                  ]}
                >
                  <AppText color="muted" variant="caption">
                    بلا صورة
                  </AppText>
                </View>
              )}
              <View style={styles.grow}>
                <AppText variant="label">{candidate.name}</AppText>
                {candidate.title ? (
                  <AppText color="muted" variant="caption">
                    {candidate.title}
                  </AppText>
                ) : null}
                {activeGroupId === 'all' && candidate.groupId ? (
                  <AppText color="primary" variant="caption">
                    {groups.find((group) => group.id === candidate.groupId)?.name ?? 'مجموعة غير معروفة'}
                  </AppText>
                ) : null}
                {archived ? (
                  <View style={styles.archiveDetails}>
                    <AppText color="muted" variant="caption">مرشح سابق</AppText>
                    {candidate.termEndedAt ? <AppText color="muted" variant="caption">حتى {candidate.termEndedAt}</AppText> : null}
                    {candidate.archiveReason ? <AppText color="muted" variant="caption">السبب: {candidate.archiveReason}</AppText> : null}
                    {successorName ? <AppText color="muted" variant="caption">خلفه: {successorName}</AppText> : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.cardActions}>
                <AppButton
                  icon={<Edit2 color={theme.palette.foreground} size={17} />}
                  onPress={() => openEditCandidate(candidate)}
                  variant="ghost"
                >
                  تعديل
                </AppButton>
                {archived ? (
                  <AppButton
                    disabled={busyAction === `candidate-restore-${candidate.id}`}
                    icon={<Undo2 color={theme.palette.foreground} size={17} />}
                    onPress={() => restoreCandidate(candidate)}
                    variant="secondary"
                  >
                    إعادة
                  </AppButton>
                ) : (
                  <AppButton
                    icon={<Archive color={theme.palette.foreground} size={17} />}
                    onPress={() => openArchive(candidate)}
                    variant="secondary"
                  >
                    أرشفة
                  </AppButton>
                )}
                <AppButton
                  disabled={busyAction === `candidate-delete-${candidate.id}`}
                  icon={<Trash2 color={theme.palette.danger} size={17} />}
                  onPress={() => removeCandidate(candidate)}
                  variant="danger"
                >
                  حذف
                </AppButton>
              </View>
            </AppCard>
          );
        })
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setCandidateModalOpen(false)}
        transparent
        visible={candidateModalOpen}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <AppCard style={styles.modalCard}>
              <View style={styles.modalHeading}>
                <AppText style={styles.grow} variant="heading">
                  {editingCandidate ? 'تعديل المرشح' : 'إضافة مرشح'}
                </AppText>
                <Pressable
                  accessibilityLabel="إغلاق"
                  accessibilityRole="button"
                  onPress={() => setCandidateModalOpen(false)}
                >
                  <X color={theme.palette.foreground} size={24} />
                </Pressable>
              </View>
              {error ? <AppText color="danger">{error}</AppText> : null}
              <AppText variant="label">الاسم</AppText>
              <AppInput
                onChangeText={(name) =>
                  setCandidateForm((current) => ({ ...current, name }))
                }
                value={candidateForm.name}
              />
              <AppText variant="label">المنصب أو العنوان</AppText>
              <AppInput
                onChangeText={(title) =>
                  setCandidateForm((current) => ({ ...current, title }))
                }
                value={candidateForm.title}
              />
              <AppText variant="label">الصورة</AppText>
              {candidatePreviewUrl ? (
                <Image
                  accessibilityLabel="معاينة صورة المرشح"
                  contentFit="cover"
                  source={{ uri: candidatePreviewUrl }}
                  style={styles.previewImage}
                />
              ) : null}
              <AppButton
                icon={<ImagePlus color={theme.palette.foreground} size={18} />}
                loading={uploading}
                onPress={() => void pickCandidateImage()}
                variant="secondary"
              >
                اختيار ورفع صورة
              </AppButton>
              <AppInput
                autoCapitalize="none"
                onChangeText={(imageUrl) =>
                  setCandidateForm((current) => ({ ...current, imageUrl }))
                }
                placeholder="أو الصق رابطًا مباشرًا"
                textAlign="left"
                value={candidateForm.imageUrl}
              />
              {candidateForm.imageUrl ? (
                <AppButton
                  onPress={() =>
                    setCandidateForm((current) => ({
                      ...current,
                      imageUrl: '',
                    }))
                  }
                  variant="ghost"
                >
                  مسح الصورة
                </AppButton>
              ) : null}
              <AppText variant="label">المجموعة</AppText>
              <View style={styles.tabs}>
                <AppButton
                  onPress={() =>
                    setCandidateForm((current) => ({
                      ...current,
                      groupId: null,
                    }))
                  }
                  variant={candidateForm.groupId === null ? 'primary' : 'secondary'}
                >
                  بلا مجموعة
                </AppButton>
                {orderedGroups.map((group) => (
                  <AppButton
                    key={group.id}
                    onPress={() =>
                      setCandidateForm((current) => ({
                        ...current,
                        groupId: group.id,
                      }))
                    }
                    variant={candidateForm.groupId === group.id ? 'primary' : 'secondary'}
                  >
                    {group.name}
                  </AppButton>
                ))}
              </View>
              <View style={styles.modalActions}>
                <AppButton
                  icon={<X color={theme.palette.foreground} size={18} />}
                  onPress={() => setCandidateModalOpen(false)}
                  variant="secondary"
                >
                  إلغاء
                </AppButton>
                <AppButton
                  icon={<Save color={theme.palette.primaryForeground} size={18} />}
                  loading={busyAction === 'candidate-save'}
                  onPress={() => void saveCandidate()}
                >
                  حفظ
                </AppButton>
              </View>
            </AppCard>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setArchiveTarget(null)}
        transparent
        visible={archiveTarget !== null}
      >
        <View style={styles.modalBackdrop}>
          <AppCard style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <AppText style={styles.grow} variant="heading">
                أرشفة {archiveTarget?.name}
              </AppText>
              <Pressable
                accessibilityLabel="إغلاق"
                accessibilityRole="button"
                onPress={() => setArchiveTarget(null)}
              >
                <X color={theme.palette.foreground} size={24} />
              </Pressable>
            </View>
            {error ? <AppText color="danger">{error}</AppText> : null}
            <AppText color="muted">
              سيحفظ سجل المرشح ويستثنى من التصويت والترتيب الحالي.
            </AppText>
            <AppText variant="label">تاريخ الانتهاء</AppText>
            <AppInput
              onChangeText={(termEndedAt) =>
                setArchiveForm((current) => ({ ...current, termEndedAt }))
              }
              placeholder="YYYY-MM-DD"
              textAlign="left"
              value={archiveForm.termEndedAt}
            />
            <AppText variant="label">السبب</AppText>
            <AppInput
              maxLength={200}
              multiline
              onChangeText={(reason) =>
                setArchiveForm((current) => ({ ...current, reason }))
              }
              placeholder="استقال، تمت إقالته، انتهت ولايته..."
              value={archiveForm.reason}
            />
            <AppText variant="label">الخليفة</AppText>
            <View style={styles.tabs}>
              <AppButton
                onPress={() =>
                  setArchiveForm((current) => ({
                    ...current,
                    successorId: null,
                  }))
                }
                variant={archiveForm.successorId === null ? 'primary' : 'secondary'}
              >
                لا يوجد
              </AppButton>
              {successors.map((candidate) => (
                <AppButton
                  key={candidate.id}
                  onPress={() =>
                    setArchiveForm((current) => ({
                      ...current,
                      successorId: candidate.id,
                    }))
                  }
                  variant={archiveForm.successorId === candidate.id ? 'primary' : 'secondary'}
                >
                  {candidate.name}
                </AppButton>
              ))}
            </View>
            <View style={styles.modalActions}>
              <AppButton
                onPress={() => setArchiveTarget(null)}
                variant="secondary"
              >
                إلغاء
              </AppButton>
              <AppButton
                icon={<Archive color={theme.palette.primaryForeground} size={18} />}
                loading={busyAction === 'candidate-archive'}
                onPress={() => void submitArchive()}
              >
                أرشفة
              </AppButton>
            </View>
          </AppCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  archiveDetails: {
    gap: 1,
    paddingTop: 4,
  },
  archived: {
    opacity: 0.75,
  },
  candidateCard: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  candidateImage: {
    borderRadius: 999,
    height: 64,
    width: 64,
  },
  cardActions: {
    gap: 6,
  },
  container: {
    gap: 16,
  },
  grow: {
    flex: 1,
    minWidth: 120,
  },
  groupActions: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  groupCreator: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    alignSelf: 'center',
    gap: 12,
    maxWidth: 620,
    width: '100%',
  },
  modalHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  previewImage: {
    alignSelf: 'center',
    borderRadius: 16,
    height: 180,
    width: 180,
  },
  tabs: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});

/*
PORT STATUS
  source:     resources/js/Components/admin/AdminPollManager.tsx (660 lines)
  confidence: high
  todos:      0
  notes:      Native forms, image picker, lifecycle controls, group ordering, and typed mutations preserve the source manager.
*/
