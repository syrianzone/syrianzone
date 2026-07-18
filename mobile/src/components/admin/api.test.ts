import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import {
  archiveAdminCandidate,
  createAdminCandidate,
  createAdminGroup,
  createAdminPoll,
  deleteAdminCandidate,
  deleteAdminGroup,
  deleteAdminPoll,
  fetchAdminPollCatalog,
  fetchAdminPollDetail,
  reorderAdminGroups,
  restoreAdminCandidate,
  setDefaultAdminGroup,
  uploadAdminCandidateImage,
  updateAdminCandidate,
  updateAdminGroup,
  updateAdminPoll,
  type AdminCandidate,
  type AdminGroup,
} from './api';

const poll = {
  id: 'poll-1',
  isActive: true,
  slug: 'cabinet',
  timezone: 'Europe/Amsterdam',
  title: 'تقييم الحكومة',
};
const group: AdminGroup = {
  id: 'group-1',
  isDefault: true,
  key: 'minister',
  name: 'الوزراء',
  pollId: poll.id,
  sortOrder: 0,
};
const candidate: AdminCandidate = {
  archiveReason: null,
  category: 'minister',
  groupId: group.id,
  id: 'candidate-1',
  imageUrl: null,
  name: 'مرشح',
  status: 'active',
  successorId: null,
  termEndedAt: null,
  termStartedAt: null,
  title: 'وزير',
};

describe('admin poll API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reads the role-gated catalog and archived-inclusive poll detail', async () => {
    const calls: { path: string; auth: boolean | undefined }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ auth: options.auth, path });
        return options.schema.parse(
          path.endsWith('/poll-1')
            ? { data: { candidates: [candidate], groups: [group], poll } }
            : { data: [{ ...poll, candidatesCount: 1 }] },
        );
      },
    );

    await fetchAdminPollCatalog();
    await fetchAdminPollDetail('poll-1');

    expect(calls).toEqual([
      { auth: true, path: '/api/mobile/admin/polls' },
      { auth: true, path: '/api/mobile/admin/polls/poll-1' },
    ]);
  });

  test('maps poll create, update, and delete to the declared envelopes', async () => {
    const calls: {
      body: unknown;
      method: string | undefined;
      path: string;
    }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ body: options.body, method: options.method, path });
        return options.schema.parse(
          options.method === 'DELETE'
            ? { data: { deleted: true } }
            : { data: poll },
        );
      },
    );
    const input = {
      isActive: true,
      slug: 'cabinet',
      timezone: 'Europe/Amsterdam',
      title: 'تقييم الحكومة',
    };

    await createAdminPoll(input);
    await updateAdminPoll('poll-1', input);
    await deleteAdminPoll('poll-1');

    expect(calls).toEqual([
      { body: input, method: 'POST', path: '/api/mobile/admin/polls' },
      { body: input, method: 'PUT', path: '/api/mobile/admin/polls/poll-1' },
      { body: undefined, method: 'DELETE', path: '/api/mobile/admin/polls/poll-1' },
    ]);
  });

  test('maps every group operation and preserves ordered identifiers', async () => {
    const calls: {
      body: unknown;
      method: string | undefined;
      path: string;
    }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ body: options.body, method: options.method, path });
        const payload = path.endsWith('/reorder')
          ? { data: { groups: [group] } }
          : options.method === 'DELETE'
            ? { data: { deleted: true } }
            : { data: group };
        return options.schema.parse(payload);
      },
    );

    await createAdminGroup(poll.id, 'الوزراء');
    await updateAdminGroup(group.id, 'وزراء الحكومة');
    await reorderAdminGroups([group]);
    await setDefaultAdminGroup(group.id);
    await deleteAdminGroup(group.id);

    expect(calls).toEqual([
      {
        body: { name: 'الوزراء', pollId: poll.id },
        method: 'POST',
        path: '/api/mobile/admin/candidate-groups',
      },
      {
        body: { name: 'وزراء الحكومة' },
        method: 'PUT',
        path: '/api/mobile/admin/candidate-groups/group-1',
      },
      {
        body: { groups: [{ id: group.id, sortOrder: 0 }] },
        method: 'POST',
        path: '/api/mobile/admin/candidate-groups/reorder',
      },
      {
        body: undefined,
        method: 'POST',
        path: '/api/mobile/admin/candidate-groups/group-1/default',
      },
      {
        body: undefined,
        method: 'DELETE',
        path: '/api/mobile/admin/candidate-groups/group-1',
      },
    ]);
  });

  test('maps candidate save, lifecycle, and delete operations', async () => {
    const calls: {
      body: unknown;
      method: string | undefined;
      path: string;
    }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ body: options.body, method: options.method, path });
        return options.schema.parse(
          path.endsWith('/uploads')
            ? { data: { url: 'https://syrian.zone/storage/candidates/image.png' } }
            : options.method === 'DELETE'
              ? { data: { deleted: true } }
              : { data: candidate },
        );
      },
    );
    const input = {
      groupId: group.id,
      imageUrl: null,
      name: candidate.name,
      pollId: poll.id,
      title: candidate.title,
    };

    await createAdminCandidate(input);
    await updateAdminCandidate(candidate.id, input);
    await archiveAdminCandidate(candidate.id, {
      archiveReason: 'انتهت الولاية',
      successorId: null,
      termEndedAt: '2026-07-16',
    });
    await restoreAdminCandidate(candidate.id);
    await deleteAdminCandidate(candidate.id);
    await uploadAdminCandidateImage('file:///image.png', 'image.png');

    expect(calls.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: 'POST', path: '/api/mobile/admin/candidates' },
      { method: 'PUT', path: '/api/mobile/admin/candidates/candidate-1' },
      { method: 'PATCH', path: '/api/mobile/admin/candidates/candidate-1/archive' },
      { method: 'PATCH', path: '/api/mobile/admin/candidates/candidate-1/restore' },
      { method: 'DELETE', path: '/api/mobile/admin/candidates/candidate-1' },
      { method: 'POST', path: '/api/mobile/admin/uploads' },
    ]);
    expect(calls[2]?.body).toEqual({
      archiveReason: 'انتهت الولاية',
      successorId: null,
      termEndedAt: '2026-07-16',
    });
    expect(calls[5]?.body).toBeInstanceOf(FormData);
  });
});
