import type { AdminVehicleDetail, SetStatusInput } from '@haupcar/shared';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/api';
import { statusLabel } from '@/lib/messages';
import { useSetStatus } from './api';

type Decision = SetStatusInput['status'];

const DONE: Record<Decision, string> = {
  approved: 'อนุมัติแล้ว รถเปิดให้เช่าได้',
  rejected: 'ส่งกลับให้เจ้าของรถแก้ไขแล้ว',
  suspended: 'ระงับรถชั่วคราวแล้ว',
};

export function DecisionPanel({ vehicle }: { vehicle: AdminVehicleDetail }) {
  const id = useId();
  const setStatus = useSetStatus(vehicle.id);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const decide = (status: Decision) => {
    const needsReason = status !== 'approved';
    if (needsReason && !reason.trim()) {
      setReasonError('บอกเหตุผลให้เจ้าของรถรู้ว่าต้องแก้อะไร');
      return;
    }
    setReasonError(null);
    setStatus.mutate(
      { status, version: vehicle.version, ...(needsReason && { reason: reason.trim() }) },
      {
        onSuccess: () => {
          setReason('');
          toast.success(DONE[status]);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const reasonField = (
    <Field data-invalid={!!reasonError}>
      <FieldLabel htmlFor={`${id}-reason`}>เหตุผล (เจ้าของรถจะเห็น)</FieldLabel>
      <Textarea
        id={`${id}-reason`}
        rows={3}
        value={reason}
        aria-invalid={!!reasonError}
        onChange={(e) => setReason(e.target.value)}
        placeholder="เช่น รูปเล่มทะเบียนไม่ชัด ถ่ายใหม่ให้เห็นเลขตัวถัง"
      />
      <FieldError>{reasonError}</FieldError>
    </Field>
  );
  const busy = setStatus.isPending;

  return (
    <section
      aria-labelledby="decision-heading"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <h2 id="decision-heading" className="text-lg font-semibold">
        ผลการตรวจ
      </h2>
      {vehicle.status === 'pending_review' && (
        <>
          <Button size="lg" disabled={busy} onClick={() => decide('approved')}>
            อนุมัติ
          </Button>
          {reasonField}
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={() => decide('rejected')}
          >
            ไม่อนุมัติ
          </Button>
        </>
      )}
      {vehicle.status === 'approved' && (
        <>
          {reasonField}
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={() => decide('suspended')}
          >
            ระงับชั่วคราว
          </Button>
        </>
      )}
      {vehicle.status === 'suspended' && (
        <Button size="lg" disabled={busy} onClick={() => decide('approved')}>
          เปิดให้เช่าอีกครั้ง
        </Button>
      )}
      {(vehicle.status === 'draft' ||
        vehicle.status === 'rejected' ||
        vehicle.status === 'archived') && (
        <p className="text-muted-foreground">
          สถานะ “{statusLabel[vehicle.status]}” ยังไม่มีอะไรให้ตัดสิน รอเจ้าของรถส่งตรวจ
        </p>
      )}
    </section>
  );
}
