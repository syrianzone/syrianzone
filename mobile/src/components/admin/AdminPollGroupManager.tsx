import { Edit2, Plus, Save, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import {
  createAdminGroup,
  deleteAdminGroup,
  type AdminGroup,
  updateAdminGroup,
} from './api';

interface AdminPollGroupManagerProps {
  initialGroups: readonly AdminGroup[];
  onGroupsChange?: () => void;
  pollId: string;
}

export default function AdminPollGroupManager({
  initialGroups,
  onGroupsChange,
  pollId,
}: AdminPollGroupManagerProps) {
  const { theme } = useAppTheme();
  const [groups, setGroups] = useState<AdminGroup[]>([...initialGroups]);
  const [newGroupName, setNewGroupName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newGroupName.trim();
    if (!name) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const group = await createAdminGroup(pollId, name);
      setGroups((current) => [...current, group]);
      setNewGroupName('');
      onGroupsChange?.();
    } catch {
      setError('تعذرت إضافة المجموعة.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'حذف المجموعة؟',
      'سيبقى مرشحو هذه المجموعة بلا تعيين.',
      [
        { style: 'cancel', text: 'إلغاء' },
        {
          onPress: () => {
            setSavingId(id);
            setError(null);
            void deleteAdminGroup(id)
              .then(() => {
                setGroups((current) =>
                  current.filter((group) => group.id !== id),
                );
                onGroupsChange?.();
              })
              .catch(() => setError('تعذر حذف المجموعة.'))
              .finally(() => setSavingId(null));
          },
          style: 'destructive',
          text: 'حذف',
        },
      ],
    );
  };

  const startEdit = (group: AdminGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
    setError(null);
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) {
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const group = await updateAdminGroup(id, name);
      setGroups((current) =>
        current.map((item) => (item.id === id ? group : item)),
      );
      setEditingId(null);
      onGroupsChange?.();
    } catch {
      setError('تعذر تحديث المجموعة.');
    } finally {
      setSavingId(null);
    }
  };

  const orderedGroups = [...groups].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );

  return (
    <View style={styles.container}>
      {error ? <AppText color="danger">{error}</AppText> : null}
      <AppText variant="label">اسم مجموعة جديدة</AppText>
      <View style={styles.addRow}>
        <AppInput
          onChangeText={setNewGroupName}
          onSubmitEditing={() => void handleAdd()}
          placeholder="مثال: الحكومة"
          returnKeyType="done"
          style={styles.grow}
          testID="admin-group-new-name"
          value={newGroupName}
        />
        <AppButton
          disabled={!newGroupName.trim()}
          icon={<Plus color={theme.palette.primaryForeground} size={18} />}
          loading={adding}
          onPress={() => void handleAdd()}
          testID="admin-group-add"
        >
          إضافة
        </AppButton>
      </View>

      {orderedGroups.length === 0 ? (
        <AppCard>
          <AppText color="muted">لا توجد مجموعات.</AppText>
        </AppCard>
      ) : (
        orderedGroups.map((group) => (
          <AppCard key={group.id} style={styles.groupCard}>
            {editingId === group.id ? (
              <View style={styles.editRow}>
                <AppInput
                  onChangeText={setEditName}
                  style={styles.grow}
                  testID={`admin-group-edit-name-${group.id}`}
                  value={editName}
                />
                <AppButton
                  icon={<Save color={theme.palette.foreground} size={17} />}
                  loading={savingId === group.id}
                  onPress={() => void saveEdit(group.id)}
                  testID={`admin-group-save-${group.id}`}
                  variant="ghost"
                >
                  حفظ
                </AppButton>
                <AppButton
                  icon={<X color={theme.palette.foreground} size={17} />}
                  onPress={() => setEditingId(null)}
                  variant="ghost"
                >
                  إلغاء
                </AppButton>
              </View>
            ) : (
              <View style={styles.groupRow}>
                <AppText style={styles.grow} variant="label">
                  {group.name}
                </AppText>
                <AppButton
                  icon={<Edit2 color={theme.palette.foreground} size={17} />}
                  onPress={() => startEdit(group)}
                  testID={`admin-group-edit-${group.id}`}
                  variant="ghost"
                >
                  تعديل
                </AppButton>
                <AppButton
                  disabled={savingId === group.id}
                  icon={<Trash2 color={theme.palette.danger} size={17} />}
                  onPress={() => handleDelete(group.id)}
                  testID={`admin-group-delete-${group.id}`}
                  variant="danger"
                >
                  حذف
                </AppButton>
              </View>
            )}
          </AppCard>
        ))
      )}
      <AppText color="muted" variant="caption">
        ترتب المجموعات حسب sortOrder المحفوظ.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  container: {
    gap: 12,
  },
  editRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupCard: {
    padding: 12,
  },
  groupRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  grow: {
    flex: 1,
    minWidth: 140,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/admin/AdminPollGroupManager.tsx (204 lines)
  confidence: high
  todos:      0
  notes:      Native inputs, confirmations, and typed mutations preserve group create, edit, and delete behavior.
*/
