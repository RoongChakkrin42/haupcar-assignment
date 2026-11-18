import type { CarModel, CreateVehicleInput } from '@haupcar/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MapPicker } from '@/components/map-picker';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/api';
import { PROVINCES } from '@/lib/messages';
import { cn } from '@/lib/utils';
import {
  emptyVehicleForm,
  toVehiclePayload,
  type VehicleFormValues,
  vehicleFormSchema,
} from './vehicle-form';

type Props = {
  models: CarModel[];
  defaultValues?: Partial<VehicleFormValues>;
  submitLabel: string;
  onSubmit: (payload: CreateVehicleInput) => Promise<unknown>;
  /** Extra note shown above the save button (e.g. "editing the plate re-queues review"). */
  note?: ReactNode;
};

// API field → form field, for server-side validation errors.
type Name = keyof VehicleFormValues;
const FIELD_FROM_API: Record<string, Name> = { dailyPrice: 'dailyPriceBaht' };

// Same box as <Input> (height, radius, padding, text size) so rows line up.
const nativeSelect =
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive';

export function VehicleForm({ models, defaultValues, submitLabel, onSubmit, note }: Props) {
  const id = useId();
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: { ...emptyVehicleForm, ...defaultValues },
  });
  const { register, handleSubmit, formState, setError, control } = form;
  const err = (name: Name) => formState.errors[name];

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toVehiclePayload(vehicleFormSchema.parse(values)));
    } catch (e) {
      const issues = (e as { issues?: { path: string; message: string }[] }).issues ?? [];
      const known = issues.filter((i) => FIELD_FROM_API[i.path] ?? i.path in emptyVehicleForm);
      for (const i of known) {
        setError(FIELD_FROM_API[i.path] ?? (i.path as Name), { message: i.message });
      }
      if (!known.length) setError('root', { message: errorMessage(e) });
    }
  });

  const field = (name: Name, label: string, input: ReactNode, hint?: string) => (
    <Field data-invalid={!!err(name)}>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      {input}
      {hint && <FieldDescription>{hint}</FieldDescription>}
      <FieldError errors={[err(name)]} />
    </Field>
  );
  const inputProps = (name: Name) => ({
    id: `${id}-${name}`,
    'aria-invalid': !!err(name),
    ...register(name),
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">ตัวรถ</h2>
        {field(
          'modelId',
          'รุ่นรถ',
          <select {...inputProps('modelId')} className={nativeSelect}>
            <option value="">เลือกรุ่น</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.make} {m.model} {m.year}
              </option>
            ))}
          </select>,
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            'plateNumber',
            'เลขทะเบียน',
            <Input {...inputProps('plateNumber')} placeholder="1กข 1234" autoComplete="off" />,
          )}
          {field(
            'plateProvince',
            'จังหวัด',
            <select {...inputProps('plateProvince')} className={nativeSelect}>
              <option value="">เลือกจังหวัด</option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>,
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {field(
            'vin',
            'เลขตัวถัง (VIN)',
            <Input {...inputProps('vin')} autoComplete="off" />,
            'ดูได้ในเล่มทะเบียน',
          )}
          {field('color', 'สี', <Input {...inputProps('color')} />)}
          {field(
            'mileageKm',
            'เลขไมล์ (กม.)',
            <Input {...inputProps('mileageKm')} inputMode="numeric" />,
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">จุดรับรถและราคา</h2>
        <Field data-invalid={!!err('location')}>
          <FieldLabel>จุดรับรถ</FieldLabel>
          <Controller
            control={control}
            name="location"
            render={({ field: f }) => <MapPicker value={f.value ?? null} onChange={f.onChange} />}
          />
          <FieldError errors={[err('location')]} />
        </Field>
        {field(
          'pickupAddress',
          'ที่อยู่จุดรับรถ',
          <Input {...inputProps('pickupAddress')} placeholder="เช่น ลานจอดคอนโด ซอยสุขุมวิท 24" />,
        )}
        <div className="sm:max-w-xs">
          {field(
            'dailyPriceBaht',
            'ราคาต่อวัน (บาท)',
            <Input {...inputProps('dailyPriceBaht')} inputMode="decimal" placeholder="1,200" />,
          )}
        </div>
        {field(
          'description',
          'รายละเอียดเพิ่มเติม',
          <Textarea {...inputProps('description')} rows={3} />,
        )}
      </section>

      <div className="flex flex-col gap-3">
        {note}
        {formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {formState.errors.root.message}
          </p>
        )}
        <div>
          <Button
            type="submit"
            size="lg"
            disabled={formState.isSubmitting}
            className={cn('min-w-32')}
          >
            {formState.isSubmitting ? 'กำลังบันทึก…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
