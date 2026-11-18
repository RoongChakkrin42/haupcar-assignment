import { type CreateVehicleInput, locationSchema, type Vehicle } from '@haupcar/shared';
import { z } from 'zod';
import { bahtInputFromSatang, satangFromBahtInput } from '@/lib/format';

const optionalText = z.string().trim();

/** Form fields are strings (what inputs give us); toVehiclePayload converts to API types. */
export const vehicleFormSchema = z.object({
  modelId: z.string().min(1, 'เลือกรุ่นรถ'),
  plateNumber: z.string().trim().min(1, 'กรอกเลขทะเบียน').max(20),
  plateProvince: z.string().trim().min(1, 'ระบุจังหวัดของป้ายทะเบียน'),
  vin: optionalText.max(17, 'เลขตัวถังมีไม่เกิน 17 ตัวอักษร'),
  color: optionalText.max(30),
  mileageKm: optionalText.refine(
    (s) => s === '' || /^\d+$/.test(s.replaceAll(',', '')),
    'กรอกเป็นตัวเลขจำนวนเต็ม',
  ),
  dailyPriceBaht: optionalText.refine((s) => {
    const satang = satangFromBahtInput(s);
    return satang === null || satang > 0;
  }, 'กรอกราคาเป็นตัวเลข เช่น 1200 หรือ 1,200.50'),
  location: locationSchema.nullable(),
  pickupAddress: optionalText.max(300),
  description: optionalText.max(2000),
});

export type VehicleFormValues = z.input<typeof vehicleFormSchema>;

export const emptyVehicleForm: VehicleFormValues = {
  modelId: '',
  plateNumber: '',
  plateProvince: '',
  vin: '',
  color: '',
  mileageKm: '',
  dailyPriceBaht: '',
  location: null,
  pickupAddress: '',
  description: '',
};

const orNull = (s: string) => (s === '' ? null : s);

export function toVehiclePayload(v: z.output<typeof vehicleFormSchema>): CreateVehicleInput {
  return {
    modelId: v.modelId,
    plateNumber: v.plateNumber,
    plateProvince: v.plateProvince,
    vin: orNull(v.vin),
    color: orNull(v.color),
    mileageKm: v.mileageKm === '' ? null : Number(v.mileageKm.replaceAll(',', '')),
    location: v.location,
    pickupAddress: orNull(v.pickupAddress),
    dailyPrice: satangFromBahtInput(v.dailyPriceBaht),
    description: orNull(v.description),
  };
}

type EditableVehicle = Pick<
  Vehicle,
  | 'plateNumber'
  | 'plateProvince'
  | 'vin'
  | 'color'
  | 'mileageKm'
  | 'location'
  | 'pickupAddress'
  | 'dailyPrice'
  | 'description'
> & { model: { id: string } };

export function vehicleToForm(v: EditableVehicle): VehicleFormValues {
  return {
    modelId: v.model.id,
    plateNumber: v.plateNumber,
    plateProvince: v.plateProvince,
    vin: v.vin ?? '',
    color: v.color ?? '',
    mileageKm: v.mileageKm == null ? '' : String(v.mileageKm),
    dailyPriceBaht: bahtInputFromSatang(v.dailyPrice),
    location: v.location,
    pickupAddress: v.pickupAddress ?? '',
    description: v.description ?? '',
  };
}
