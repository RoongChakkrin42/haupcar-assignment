import type { AdminVehicle, VehicleStatus } from '@haupcar/shared';
import { useNavigate, useSearchParams } from 'react-router';
import { type Column, DataTable, Pagination } from '@/components/data-table';
import { LicensePlate } from '@/components/license-plate';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { formatBaht, formatDateTime } from '@/lib/format';
import { statusLabel } from '@/lib/messages';
import { cn } from '@/lib/utils';
import { useAdminVehicles } from './api';

const TABS: (VehicleStatus | 'all')[] = [
  'pending_review',
  'approved',
  'rejected',
  'suspended',
  'all',
];

const columns: Column<AdminVehicle>[] = [
  {
    header: 'ทะเบียน',
    cell: (v) => <LicensePlate number={v.plateNumber} province={v.plateProvince} />,
  },
  {
    header: 'รถ',
    cell: (v) => (
      <span className="font-medium">
        {v.model.make} {v.model.model} {v.model.year}
      </span>
    ),
  },
  {
    header: 'เจ้าของ',
    cell: (v) => (
      <div className="flex flex-col">
        <span>{v.owner.name}</span>
        <span className="text-sm text-muted-foreground">{v.owner.email}</span>
      </div>
    ),
  },
  {
    header: 'ราคาต่อวัน',
    cell: (v) => formatBaht(v.dailyPrice),
    className: 'text-right tabular-nums',
  },
  { header: 'อัปเดตล่าสุด', cell: (v) => formatDateTime(v.updatedAt), className: 'whitespace-nowrap' },
  { header: 'สถานะ', cell: (v) => <StatusBadge status={v.status} /> },
];

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('status') as VehicleStatus | 'all' | null) ?? 'pending_review';
  const page = Number(params.get('page') ?? 1);
  const { data, error, isPending, refetch } = useAdminVehicles(
    page,
    tab === 'all' ? undefined : tab,
  );

  return (
    <>
      <PageHeader title="ตรวจรถ" />
      <div role="tablist" aria-label="กรองตามสถานะ" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setParams({ status: t })}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              tab === t
                ? 'border-foreground bg-foreground text-background'
                : 'bg-card hover:bg-muted',
            )}
          >
            {t === 'all' ? 'ทั้งหมด' : statusLabel[t]}
            {t === 'pending_review' && tab === t && data ? ` (${data.total})` : ''}
          </button>
        ))}
      </div>
      {tab === 'pending_review' && (
        <p className="mb-3 text-sm text-muted-foreground">เรียงจากรถที่รอนานที่สุด</p>
      )}

      {isPending ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.total === 0 ? (
        <EmptyState title={tab === 'pending_review' ? 'ไม่มีรถรอตรวจ' : 'ไม่มีรถในสถานะนี้'} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(v) => v.id}
            onRowClick={(v) => navigate(`/admin/vehicles/${v.id}`)}
          />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(p) => setParams({ status: tab, page: String(p) })}
          />
        </>
      )}
    </>
  );
}
