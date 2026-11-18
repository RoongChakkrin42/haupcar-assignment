import type { AdminVehicleDetail } from '@haupcar/shared';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { LicensePlate } from '@/components/license-plate';
import { ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { formatBaht, formatDate, formatDateTime } from '@/lib/format';
import { documentLabel, statusLabel } from '@/lib/messages';
import { cn } from '@/lib/utils';
import { useAdminVehicle } from './api';
import { DecisionPanel } from './decision-panel';

export function ReviewPage() {
  const { id = '' } = useParams();
  const { data: v, error, isPending, refetch } = useAdminVehicle(id);

  if (isPending) return <ListSkeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> คิวตรวจ
        </Link>
        <header className="flex flex-wrap items-center gap-5">
          <LicensePlate number={v.plateNumber} province={v.plateProvince} size="lg" />
          <div className="flex flex-col items-start gap-2">
            <h1 className="text-2xl font-semibold">
              {v.model.make} {v.model.model} {v.model.year}
            </h1>
            <StatusBadge status={v.status} />
          </div>
        </header>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Photos vehicle={v} />
          <Section title="ข้อมูลรถ">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <Row label="เลขตัวถัง (VIN)">{v.vin ?? '—'}</Row>
              <Row label="สี">{v.color ?? '—'}</Row>
              <Row label="เลขไมล์">
                {v.mileageKm == null ? '—' : `${v.mileageKm.toLocaleString('th-TH')} กม.`}
              </Row>
              <Row label="ราคาต่อวัน">{formatBaht(v.dailyPrice)}</Row>
              <Row label="จุดรับรถ">
                {v.pickupAddress ?? '—'}
                {v.location && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${v.location.lat}&mlon=${v.location.lng}#map=17/${v.location.lat}/${v.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    ดูบนแผนที่ <ExternalLink className="size-3.5" />
                  </a>
                )}
              </Row>
              <Row label="รายละเอียด">{v.description ?? '—'}</Row>
            </dl>
            <p className="mt-2 text-sm text-muted-foreground">
              ตรวจว่าเลขทะเบียน จังหวัด และเลขตัวถังตรงกับเล่มทะเบียน
            </p>
          </Section>
          <Section title="เอกสาร">
            {v.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีเอกสาร</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {v.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" aria-hidden />
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {documentLabel[d.type]}
                    </a>
                    {d.expiresOn && (
                      <span className="text-muted-foreground">
                        หมดอายุ {formatDate(d.expiresOn)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <History vehicle={v} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <DecisionPanel vehicle={v} />
          <Section title="เจ้าของรถ">
            <p className="font-medium">{v.owner.name}</p>
            <p className="text-sm">
              <a href={`mailto:${v.owner.email}`} className="text-primary hover:underline">
                {v.owner.email}
              </a>
            </p>
            {v.owner.phone && <p className="text-sm">{v.owner.phone}</p>}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Photos({ vehicle }: { vehicle: AdminVehicleDetail }) {
  if (!vehicle.photos.length) return null;
  const [cover, ...rest] = vehicle.photos;
  return (
    <div className={cn('grid gap-2', rest.length > 0 && 'sm:grid-cols-[2fr_1fr]')}>
      <a href={cover.url} target="_blank" rel="noreferrer">
        <img
          src={cover.url}
          alt="รูปปก"
          className="aspect-[4/3] max-h-[26rem] w-full rounded-lg object-cover"
        />
      </a>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:content-start">
        {rest.map((p, i) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
            <img
              src={p.thumbUrl}
              alt={`รูปที่ ${i + 2}`}
              className="aspect-[4/3] w-full rounded-md object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function History({ vehicle }: { vehicle: AdminVehicleDetail }) {
  return (
    <Section title="ประวัติสถานะ">
      <ol className="flex flex-col gap-3 border-l pl-4">
        {vehicle.history.map((h) => (
          <li key={h.createdAt} className="text-sm">
            <p>
              <span className="font-medium">{statusLabel[h.toStatus]}</span>
              <span className="text-muted-foreground">
                {' '}
                โดย {h.changedBy.name} ({h.changedBy.role === 'admin' ? 'ทีมงาน' : 'เจ้าของรถ'}),{' '}
                {formatDateTime(h.createdAt)}
              </span>
            </p>
            {h.reason && <p className="text-muted-foreground">“{h.reason}”</p>}
          </li>
        ))}
      </ol>
    </Section>
  );
}
