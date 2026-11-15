import React, { useEffect, useState } from 'react';
import { useAuth } from '@/Contexts/AuthContext';
import SettingsConflictModal from './SettingsConflictModal';
import {
  applyConflictChoices, runLoginSync,
  type ConflictChoices, type SettingConflict,
} from './settingsSync';

// Global login sync: runs once per session per user (mount + login).
// Silent merges (empty-side fills, prayer-log union, quran newer-wins,
// bookmark union push) happen first; genuine scalar conflicts surface the
// explicit-choice modal. Mounted once inside MainLayout's AuthProvider.
export default function SettingsSync() {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<SettingConflict[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const flag = `sz-sync-v1-${user.id}`;
    let cancelled = false;
    try {
      if (sessionStorage.getItem(flag)) return;
    } catch {
      // private mode: run every mount
    }
    void runLoginSync(user.id, user.settings ?? null)
      .then((res) => {
        if (cancelled) return;
        if (res.conflicts.length > 0) {
          setConflicts(res.conflicts);
        } else {
          try {
            sessionStorage.setItem(flag, '1');
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // best-effort: never block the page on sync
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const snooze = () => {
    setConflicts(null);
    if (user?.id) {
      try {
        sessionStorage.setItem(`sz-sync-v1-${user.id}`, '1');
      } catch {
        // ignore
      }
    }
  };

  const apply = async (choices: Partial<ConflictChoices>) => {
    await applyConflictChoices(conflicts ?? [], choices, user?.settings ?? null);
    snooze();
  };

  return <SettingsConflictModal conflicts={conflicts} onApply={apply} onSnooze={snooze} />;
}
