import type { Vehicle } from '@haupcar/shared';
import { readiness } from './readiness';

const base = {
  status: 'draft',
  location: { lat: 13.7, lng: 100.5 },
  pickupAddress: 'Siam',
  dailyPrice: 100000,
  photos: [{ id: 'p1', url: '/x' }],
  documents: [{ id: 'd1', type: 'registration', expiresOn: null, url: '/y' }],
} as unknown as Vehicle;

test('a complete draft can be submitted', () => {
  const r = readiness(base);
  expect(r.steps.map((s) => s.done)).toEqual([true, true, true, true]);
  expect(r.canSubmit).toBe(true);
});

test('lists what is still missing, in order', () => {
  const r = readiness({ ...base, dailyPrice: null, photos: [], documents: [] } as Vehicle);
  expect(r.steps.filter((s) => !s.done).map((s) => s.key)).toEqual([
    'pickup',
    'photos',
    'documents',
  ]);
  expect(r.canSubmit).toBe(false);
});

test('an insurance document alone does not count as the registration book', () => {
  const r = readiness({
    ...base,
    documents: [{ id: 'd2', type: 'insurance', expiresOn: null, url: '/z' }],
  } as Vehicle);
  expect(r.steps.find((s) => s.key === 'documents')?.done).toBe(false);
});

test.each(['pending_review', 'approved', 'suspended'] as const)(
  'cannot submit while %s',
  (status) => {
    expect(readiness({ ...base, status }).canSubmit).toBe(false);
  },
);

test('a rejected vehicle can be resubmitted', () => {
  expect(readiness({ ...base, status: 'rejected' }).canSubmit).toBe(true);
});
