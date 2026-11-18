import type { Vehicle, VehicleStatus } from '@haupcar/shared';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Pagination } from '@/components/data-table';
import { LicensePlate } from '@/components/license-plate';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { formatBaht } from '@/lib/format';
import { statusLabel } from '@/lib/messages';
import { cn } from '@/lib/utils';
import { useMyVehicles } from './api';

const FILTERS: (VehicleStatus | undefined)[] = [
  undefined,
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'suspended',
];

export function MyVehiclesPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as VehicleStatus | null) ?? undefined;
  const page = Number(params.get('page') ?? 1);
  const { data, error, isPending, refetch } = useMyVehicles(page, status);

  const setFilter = (next: Record<string, string | undefined>) =>
    setParams(
      Object.fromEntries(
        Object.entries({ status, page: String(page), ...next }).filter(([, v]) => v),
      ) as Record<string, string>,
    );

  return (
    <>
      <PageHeader title="รถของฉัน">
        <Button asChild size="lg">
          <Link to="/vehicles/new">
            <Plus /> ลงรถคันใหม่
          </Link>
        </Button>
      </PageHeader>

      <div role="tablist" aria-label="กรองตามสถานะ" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f ?? 'all'}
            role="tab"
            type="button"
            aria-selected={status === f}
            onClick={() => setFilter({ status: f, page: undefined })}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              status === f
                ? 'border-foreground bg-foreground text-background'
                : 'bg-card hover:bg-muted',
            )}
          >
            {f ? statusLabel[f] : 'ทั้งหมด'}
          </button>
        ))}
      </div>

      {isPending ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.total === 0 ? (
        status ? (
          <EmptyState title={`ไม่มีรถที่${statusLabel[status]}`} />
        ) : (
          <EmptyState
            title="ยังไม่มีรถในระบบ"
            action={
              <Button asChild>
                <Link to="/vehicles/new">ลงรถคันแรก</Link>
              </Button>
            }
          >
            กรอกข้อมูลรถ ใส่รูปและเล่มทะเบียน แล้วส่งให้ทีมงานตรวจ รถที่ผ่านการอนุมัติจะเปิดให้เช่าได้
          </EmptyState>
        )
      ) : (
        <>
          <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
            {data.items.map((v) => (
              <li key={v.id}>
                <VehicleRow vehicle={v} />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(p) => setFilter({ page: String(p) })}
          />
        </>
      )}
    </>
  );
}

function VehicleRow({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Link
      to={`/vehicles/${v.id}`}
      className="flex items-center gap-4 px-4 py-3 outline-none hover:bg-muted/60 focus-visible:bg-muted"
    >
      <LicensePlate number={v.plateNumber} province={v.plateProvince} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium">
          {v.model.make} {v.model.model} {v.model.year}
        </p>
        <p className="text-sm text-muted-foreground">
          {v.dailyPrice ? `${formatBaht(v.dailyPrice)} ต่อวัน` : 'ยังไม่ตั้งราคา'}
        </p>
        <StatusBadge status={v.status} className="mt-1 sm:hidden" />
      </div>
      {v.photos[0] && (
        <img
          src={v.photos[0].url}
          alt=""
          className="hidden h-14 w-20 rounded-md object-cover sm:block"
        />
      )}
      <div className="hidden w-28 shrink-0 sm:flex">
        <StatusBadge status={v.status} />
      </div>
    </Link>
  );
}
