import type { Vehicle } from '@haupcar/shared';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSubmitVehicle } from './api';
import { readiness } from './readiness';

/** The steps really are a sequence, so they're numbered. */
export function SubmitPanel({ vehicle }: { vehicle: Vehicle }) {
  const submit = useSubmitVehicle(vehicle.id);
  const { steps, canSubmit } = readiness(vehicle);

  return (
    <section aria-labelledby="submit-heading" className="rounded-lg border bg-card p-5">
      <h2 id="submit-heading" className="mb-3 text-lg font-semibold">
        ก่อนส่งให้ทีมงานตรวจ
      </h2>
      <ol className="mb-4 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                s.done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
              aria-hidden
            >
              {s.done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={s.done ? 'text-muted-foreground' : 'font-medium'}>
              {s.label}
              <span className="sr-only">{s.done ? ' (ครบแล้ว)' : ' (ยังไม่ครบ)'}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button
        size="lg"
        disabled={!canSubmit || submit.isPending}
        onClick={() =>
          submit.mutate(undefined, {
            onSuccess: () => toast.success('ส่งตรวจแล้ว ทีมงานจะแจ้งผลในหน้านี้'),
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      >
        {submit.isPending ? 'กำลังส่ง…' : vehicle.status === 'rejected' ? 'ส่งตรวจอีกครั้ง' : 'ส่งตรวจ'}
      </Button>
    </section>
  );
}
