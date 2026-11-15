import { expect, test } from 'bun:test';
import { adminPlacePatch, decodeAdminPlace, decodeReport } from './admin-model';

const raw = { id: 7, name: 'قلعة', category: 'historical', description: 'وصف موثق للمكان الذي نريد زيارته', lat: 34.7, lng: 36.6,
  thumb_url: null, saves_count: 4, status: 'rejected', user: { id: 3, name: 'مرشد', avatar_url: null },
  photos: [], saved_by_me: false, created_at: '2026-11-14T10:00:00Z', rejection_reason: 'تحتاج صورة أوضح' };

test('moderation preserves rejection, contributor and authoritative report status', () => {
  expect(decodeAdminPlace(raw)).toMatchObject({ rejectionReason: raw.rejection_reason, user: { id: 3 }, status: 'rejected' });
  const report = { id: 9, reason: 'wrong_info', details: null, status: 'open', created_at: raw.created_at, user: { id: 8, name: 'مبلّغ' }, place: { id: 7, name: 'قلعة', status: 'approved' } };
  expect(decodeReport(report)).toMatchObject({ status: 'open', place: { status: 'approved' } });
  expect(() => decodeReport({ ...report, status: 'deleted' })).toThrow();
  expect(() => decodeReport({ ...report, reason: 'invented' })).toThrow();
});

test('moderator edits send only changed fields and reject invalid coordinates or content', () => {
  const place = decodeAdminPlace(raw), form = { name: raw.name, category: raw.category, description: raw.description, lat: '34.7', lng: '36.6' };
  expect(adminPlacePatch(place, form)).toEqual({});
  expect(adminPlacePatch(place, { ...form, lat: '35', name: 'قلعة جديدة' })).toEqual({ lat: 35, name: 'قلعة جديدة' });
  expect(() => adminPlacePatch(place, { ...form, lng: '0' })).toThrow('الإحداثيات');
  expect(() => adminPlacePatch(place, { ...form, description: 'قصير' })).toThrow('وصف');
});
