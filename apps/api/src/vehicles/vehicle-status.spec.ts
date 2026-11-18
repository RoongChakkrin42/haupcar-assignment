import { assertTransition, requiresReReview } from './vehicle-status.js';

describe('assertTransition', () => {
  it.each([
    ['draft', 'pending_review'],
    ['rejected', 'pending_review'],
  ] as const)('owner can submit %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to, 'owner')).not.toThrow();
  });

  it.each([
    ['pending_review', 'approved'],
    ['draft', 'approved'],
    ['approved', 'pending_review'],
    ['pending_review', 'pending_review'],
    ['suspended', 'pending_review'],
  ] as const)('owner cannot move %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to, 'owner')).toThrow(/cannot change status/);
  });

  it.each([
    ['pending_review', 'approved'],
    ['pending_review', 'rejected'],
    ['approved', 'suspended'],
    ['suspended', 'approved'],
  ] as const)('admin can move %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to, 'admin')).not.toThrow();
  });

  it.each([
    ['draft', 'approved'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['approved', 'approved'],
    ['pending_review', 'suspended'],
  ] as const)('admin cannot move %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to, 'admin')).toThrow(/cannot change status/);
  });

  it('system re-queues an approved vehicle for review', () => {
    expect(() => assertTransition('approved', 'pending_review', 'system')).not.toThrow();
  });
});

describe('requiresReReview', () => {
  it.each(['plateNumber', 'plateProvince', 'vin', 'modelId'])(
    'is true when %s changes',
    (field) => {
      expect(requiresReReview({ [field]: 'new' }, { [field]: 'old' })).toBe(true);
    },
  );

  it('is false for price, photos, location or description changes', () => {
    expect(
      requiresReReview({ dailyPrice: 2, description: 'b' }, { dailyPrice: 1, description: 'a' }),
    ).toBe(false);
  });

  it('is false when a key field is sent with its current value', () => {
    expect(requiresReReview({ plateNumber: 'same' }, { plateNumber: 'same' })).toBe(false);
  });
});
