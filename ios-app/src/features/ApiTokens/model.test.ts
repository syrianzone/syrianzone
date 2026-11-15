import { expect, test } from 'bun:test';
import { decodeIssued, decodeTokenPage, issuePayload, tokenBoundary } from './model';
const data = {
  selfService: true,
  tokens: [],
  owners: [{ id: 1, name: 'اسم', role: 'user' }],
  capabilityGroups: { promises: { label: 'الوعود', icon: 'x' } },
  capabilities: { promises: { 'promises.review': 'مراجعة' } },
  ttlOptions: [
    { value: '7d', label: '٧ أيام' },
    { value: '30d', label: '٣٠ يوماً' },
  ],
  endpoint: 'https://syrian.zone/mcp/admin',
};
test('token creation uses only server owner, TTL and capability choices with no wildcard or mobile escalation', () => {
  const page = decodeTokenPage(data);
  expect(issuePayload(page, '1', ' مساعد ', '30d', ['promises.review'])).toEqual({
    user_id: 1,
    name: 'مساعد',
    ttl: '30d',
    permissions: ['promises.review'],
  });
  for (const input of [
    { owner: '2', ttl: '30d', selected: ['promises.review'] },
    { owner: '1', ttl: '999d', selected: ['promises.review'] },
    { owner: '1', ttl: '30d', selected: ['*'] },
    { owner: '1', ttl: '30d', selected: ['mobile'] },
    { owner: '1', ttl: '30d', selected: [] },
  ])
    expect(() => issuePayload(page, input.owner, 'اسم', input.ttl, input.selected)).toThrow();
  expect(() => decodeTokenPage({ ...data, capabilities: { system: { mobile: 'جلسة هاتف' } } })).toThrow();
});
test('plaintext disclosure requires a successful issuance payload and its boundary changes with account permissions', () => {
  expect(
    decodeIssued({
      plain_text_token: '1|ephemeral-secret',
      message: 'تم',
      abilities: ['promises.review'],
      dropped: [],
      expires_at: null,
    }),
  ).toMatchObject({ token: '1|ephemeral-secret', abilities: ['promises.review'] });
  expect(() => decodeIssued({ plain_text_token: '', message: 'تم' })).toThrow();
  expect(tokenBoundary(1, ['b', 'a'])).toBe(tokenBoundary(1, ['a', 'b']));
  expect(tokenBoundary(1, ['a'])).not.toBe(tokenBoundary(1, ['a', 'b']));
  expect(tokenBoundary(1, ['a'])).not.toBe(tokenBoundary(2, ['a']));
});
