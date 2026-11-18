import type { VehicleStatus } from '@haupcar/shared';
import { statusLabel } from '@/lib/messages';
import { cn } from '@/lib/utils';

const tone: Record<VehicleStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-pending text-pending-foreground',
  approved: 'bg-accent text-accent-foreground',
  rejected: 'bg-destructive/10 text-destructive',
  suspended: 'bg-destructive text-white',
  archived: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status, className }: { status: VehicleStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tone[status],
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
