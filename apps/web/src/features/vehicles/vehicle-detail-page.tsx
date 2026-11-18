import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LicensePlate } from '@/components/license-plate';
import { ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { useCarModels, useDeleteVehicle, useUpdateVehicle, useVehicle } from './api';
import { DocumentManager } from './document-manager';
import { PhotoManager } from './photo-manager';
import { SubmitPanel } from './submit-panel';
import { vehicleToForm } from './vehicle-form';
import { VehicleForm } from './vehicle-form-view';

export function VehicleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const vehicle = useVehicle(id);
  const models = useCarModels();
  const update = useUpdateVehicle(id);
  const remove = useDeleteVehicle(id);

  if (vehicle.isPending || models.isPending) return <ListSkeleton rows={4} />;
  if (vehicle.error) return <ErrorState error={vehicle.error} onRetry={vehicle.refetch} />;
  if (models.error) return <ErrorState error={models.error} onRetry={models.refetch} />;
  const v = vehicle.data;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          to="/vehicles"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> รถของฉัน
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

      {v.statusReason && (
        <div role="status" className="rounded-lg border-l-4 border-destructive bg-card px-4 py-3">
          <p className="font-medium">
            {v.status === 'rejected' ? 'ทีมงานยังไม่อนุมัติ' : 'รถคันนี้ถูกระงับชั่วคราว'}
          </p>
          <p className="text-muted-foreground">{v.statusReason}</p>
        </div>
      )}
      {v.status === 'pending_review' && (
        <p role="status" className="rounded-lg border-l-4 border-pending bg-card px-4 py-3">
          ทีมงานกำลังตรวจรถคันนี้ ผลจะแสดงในหน้านี้
        </p>
      )}

      {(v.status === 'draft' || v.status === 'rejected') && <SubmitPanel vehicle={v} />}
      <PhotoManager vehicle={v} />
      <DocumentManager vehicle={v} />

      <section aria-labelledby="edit-heading" className="flex flex-col gap-4">
        <h2 id="edit-heading" className="sr-only">
          แก้ไขข้อมูลรถ
        </h2>
        <VehicleForm
          key={v.version}
          models={models.data}
          defaultValues={vehicleToForm(v)}
          submitLabel="บันทึกการแก้ไข"
          note={
            v.status === 'approved' && (
              <p className="text-sm text-muted-foreground">
                แก้ทะเบียน จังหวัด เลขตัวถัง หรือรุ่น รถจะกลับไปรอตรวจอีกครั้ง ส่วนราคาและรายละเอียดแก้ได้เลย
              </p>
            )
          }
          onSubmit={async (payload) => {
            await update.mutateAsync({ ...payload, version: v.version });
            toast.success('บันทึกแล้ว');
          }}
        />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <p className="text-sm text-muted-foreground">ลบแล้วรถจะหายจากรายการ และลงทะเบียนนี้ใหม่ได้</p>
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="text-destructive">
              ลบรถคันนี้
            </Button>
          }
          title="ลบรถคันนี้?"
          description="รถจะหายจากรายการของคุณและไม่เปิดให้เช่าอีก"
          confirmLabel="ลบรถ"
          destructive
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                toast.success('ลบรถแล้ว');
                navigate('/vehicles');
              },
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      </section>
    </div>
  );
}
