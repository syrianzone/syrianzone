import {
  canModeratePlaces,
  placeModerationStatusLabel,
  reportModerationStatusLabel,
} from './model';

describe('place moderation model', () => {
  test('gates moderation to general administrators', () => {
    expect(canModeratePlaces('admin')).toBe(true);
    expect(canModeratePlaces('superadmin')).toBe(true);
    expect(canModeratePlaces('transit_admin')).toBe(false);
    expect(canModeratePlaces('user')).toBe(false);
  });

  test('labels every place and report lifecycle state', () => {
    expect(placeModerationStatusLabel('pending')).toBe('قيد المراجعة');
    expect(placeModerationStatusLabel('approved')).toBe('مقبول');
    expect(reportModerationStatusLabel('open')).toBe('مفتوح');
    expect(reportModerationStatusLabel('dismissed')).toBe('مرفوض');
  });
});
