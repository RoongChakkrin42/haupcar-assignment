import type { Vehicle } from '@haupcar/shared';

export type ReadinessStep = {
  key: 'details' | 'pickup' | 'photos' | 'documents';
  label: string;
  done: boolean;
};

/** Mirrors the API's submit rules so owners see what's missing before they press submit. */
export function readiness(
  v: Pick<Vehicle, 'status' | 'location' | 'pickupAddress' | 'dailyPrice' | 'photos' | 'documents'>,
) {
  const steps: ReadinessStep[] = [
    { key: 'details', label: 'ข้อมูลรถและทะเบียน', done: true },
    {
      key: 'pickup',
      label: 'จุดรับรถและราคาต่อวัน',
      done: v.location !== null && !!v.pickupAddress && v.dailyPrice !== null,
    },
    { key: 'photos', label: 'รูปรถอย่างน้อย 1 รูป', done: v.photos.length > 0 },
    {
      key: 'documents',
      label: 'เล่มทะเบียน',
      done: v.documents.some((d) => d.type === 'registration'),
    },
  ];
  const submittable = v.status === 'draft' || v.status === 'rejected';
  return { steps, canSubmit: submittable && steps.every((s) => s.done) };
}
