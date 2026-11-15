import { api, type ApiClient, type ApiRequestOptions } from '../../api';
import { array, integer, record } from '../../platform/validation';
import {
  bulkBatches,
  bulkPayload,
  decodeOptions,
  decodeUser,
  decodeUserPage,
  userPayload,
  type BulkAction,
  type Options,
  type UserForm,
  type UserQuery,
  type UserRecord
} from './model';

const session = (generation: number, signal?: AbortSignal): ApiRequestOptions => ({
  authenticated: true,
  sessionGeneration: generation,
  ...(signal ? { signal } : {})
});
function id(value: number): number {
  if (integer(value) < 1) throw new Error('معرّف المستخدم غير صالح.');
  return value;
}
function acknowledgement(value: unknown, ids: readonly number[], selfDeleted: boolean): { actorDeleted: boolean } {
  const row = record(value),
    actual = array(row.ids).map((item) => id(integer(item)));
  if (
    row.success !== true ||
    actual.length !== ids.length ||
    new Set(actual).size !== actual.length ||
    actual.some((key) => !ids.includes(key)) ||
    row.actor_deleted !== selfDeleted
  )
    throw new Error('لم يؤكد الخادم تغيير المستخدمين المحددين.');
  return { actorDeleted: selfDeleted };
}
export function createUsersAdminClient(client: Pick<ApiClient, 'request'> = api) {
  const bulk = (action: BulkAction, users: readonly UserRecord[], maximum: number, generation: number, signal?: AbortSignal) =>
    client.request(
      'admin/users/bulk',
      (value) =>
        acknowledgement(
          value,
          users.map((user) => user.id),
          action !== 'restore' && users.some((user) => user.isSelf)
        ),
      { ...session(generation, signal), method: 'POST', body: bulkPayload(action, users, maximum) }
    );
  return {
    options: (generation: number, signal: AbortSignal) => client.request('admin/users/options', decodeOptions, session(generation, signal)),
    list: (query: UserQuery, generation: number, signal: AbortSignal) =>
      client.request('admin/users', decodeUserPage, {
        ...session(generation, signal),
        params: { q: query.query, sort: query.sort, direction: query.direction, trashed: query.trashed, page: query.page, per_page: query.perPage }
      }),
    async selectAll(query: UserQuery, generation: number, signal: AbortSignal, onProgress: (count: number) => void): Promise<UserRecord[]> {
      const snapshot = new Map<number, UserRecord>();
      let expected: number | null = null,
        lastPage = 1;
      const check = () => {
        if (signal.aborted) throw new Error('تم إلغاء تحديد المستخدمين.');
      };
      for (let page = 1; page <= lastPage; page++) {
        check();
        const result = await client.request('admin/users', decodeUserPage, {
          ...session(generation, signal),
          params: { q: query.query, sort: query.sort, direction: query.direction, trashed: query.trashed, page, per_page: 100 }
        });
        check();
        if (expected === null) {
          expected = result.total;
          lastPage = result.lastPage;
        }
        if (result.total !== expected) throw new Error('تغيّرت نتائج البحث أثناء التحديد. حدّث القائمة وحاول مجدداً.');
        result.items.forEach((user) => snapshot.set(user.id, user));
        onProgress(snapshot.size);
      }
      check();
      if (snapshot.size !== expected) throw new Error('تغيّرت قائمة المستخدمين. لم يتم تحديد جزء منها تلقائياً، أعد المحاولة.');
      return [...snapshot.values()];
    },
    show: async (userId: number, generation: number, signal: AbortSignal) =>
      client.request(
        `admin/users/${id(userId)}`,
        (value) => {
          const user = decodeUser(record(value).user);
          if (user.id !== userId) throw new Error('سجل المستخدم لا يطابق الاختيار.');
          return user;
        },
        session(generation, signal)
      ),
    save: (form: UserForm, options: Options, generation: number) =>
      client.request(
        `admin/users${form.id === null ? '' : `/${id(form.id)}`}`,
        (value) => {
          const row = record(value),
            user = decodeUser(row.user);
          if (row.success !== true || typeof row.actor_can_manage_users !== 'boolean' || (form.id !== null && user.id !== form.id))
            throw new Error('لم يؤكد الخادم حفظ سجل المستخدم.');
          return { user, actorCanManage: row.actor_can_manage_users };
        },
        { ...session(generation), method: form.id === null ? 'POST' : 'PUT', body: userPayload(form, options, form.id === null) }
      ),
    mutate: (action: BulkAction, user: UserRecord, generation: number) =>
      client.request(
        `admin/users/${id(user.id)}${action === 'restore' ? '/restore' : action === 'force-delete' ? '/force' : ''}`,
        (value) => {
          const result = acknowledgement(value, [user.id], action !== 'restore' && user.isSelf);
          if (action === 'restore') {
            const restored = decodeUser(record(value).user);
            if (restored.id !== user.id || restored.deletedAt !== null) throw new Error('لم يؤكد الخادم استعادة المستخدم.');
          }
          return result;
        },
        { ...session(generation), method: action === 'restore' ? 'POST' : 'DELETE', body: { version: user.version } }
      ),
    bulk,
    async bulkAll(
      action: BulkAction,
      users: readonly UserRecord[],
      maximum: number,
      generation: number,
      onProgress: (count: number) => void,
      signal?: AbortSignal
    ) {
      const batches = bulkBatches(users, maximum),
        completed: UserRecord[] = [],
        acknowledged = new Set<number>();
      let actorDeleted = false;
      for (const batch of batches) {
        try {
          if (signal?.aborted) throw new Error('تم إيقاف الدفعات المتبقية. أعد قراءة القائمة قبل المحاولة.');
          const result = await bulk(action, batch, maximum, generation, signal);
          actorDeleted ||= result.actorDeleted;
          completed.push(...batch);
          batch.forEach((user) => acknowledged.add(user.id));
          onProgress(completed.length);
        } catch (error) {
          return { completed, remaining: users.filter((user) => !acknowledged.has(user.id)), actorDeleted, error };
        }
      }
      return { completed, remaining: [], actorDeleted, error: null };
    }
  };
}
export const usersAdminClient = createUsersAdminClient();
// PORT STATUS: native transport for source Filament user resource; confidence medium; todos 1 controlled-account request verification.
