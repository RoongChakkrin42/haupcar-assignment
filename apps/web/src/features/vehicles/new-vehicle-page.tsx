import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ErrorState, ListSkeleton, PageHeader } from '@/components/states';
import { useCarModels, useCreateVehicle } from './api';
import { VehicleForm } from './vehicle-form-view';

export function NewVehiclePage() {
  const navigate = useNavigate();
  const models = useCarModels();
  const create = useCreateVehicle();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ลงรถคันใหม่" />
      <p className="mb-6 max-w-prose text-muted-foreground">
        เริ่มจากรุ่นและทะเบียนก่อนก็ได้ ระบบจะบันทึกเป็นร่างไว้ แล้วค่อยเติมรูป เอกสาร และราคาทีหลัง
      </p>
      {models.isPending ? (
        <ListSkeleton />
      ) : models.error ? (
        <ErrorState error={models.error} onRetry={models.refetch} />
      ) : (
        <VehicleForm
          models={models.data}
          submitLabel="บันทึกร่าง"
          onSubmit={async (payload) => {
            const v = await create.mutateAsync(payload);
            toast.success('บันทึกร่างแล้ว ต่อไปใส่รูปและเล่มทะเบียน');
            navigate(`/vehicles/${v.id}`);
          }}
        />
      )}
    </div>
  );
}
