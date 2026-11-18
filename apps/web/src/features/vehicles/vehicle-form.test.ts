import {
  emptyVehicleForm,
  toVehiclePayload,
  vehicleFormSchema,
  vehicleToForm,
} from './vehicle-form';

const filled = {
  ...emptyVehicleForm,
  modelId: '3f1c2b7a-1d2e-4f5a-8b9c-0d1e2f3a4b5c',
  plateNumber: '1กข 1234',
  plateProvince: 'กรุงเทพมหานคร',
  dailyPriceBaht: '1,200',
  mileageKm: '25000',
  location: { lat: 13.75, lng: 100.53 },
};

test('maps form strings to the API payload', () => {
  const values = vehicleFormSchema.parse(filled);
  expect(toVehiclePayload(values)).toEqual({
    modelId: filled.modelId,
    plateNumber: '1กข 1234',
    plateProvince: 'กรุงเทพมหานคร',
    vin: null,
    color: null,
    mileageKm: 25000,
    location: { lat: 13.75, lng: 100.53 },
    pickupAddress: null,
    dailyPrice: 120000,
    description: null,
  });
});

test('requires model, plate and province only', () => {
  const result = vehicleFormSchema.safeParse(emptyVehicleForm);
  expect(result.success).toBe(false);
  const fields = result.error?.issues.map((i) => i.path[0]).sort();
  expect(fields).toEqual(['modelId', 'plateNumber', 'plateProvince']);
});

test.each([
  ['dailyPriceBaht', 'abc'],
  ['dailyPriceBaht', '0'],
  ['mileageKm', '-1'],
  ['mileageKm', '1.5'],
])('rejects %s = %j', (field, value) => {
  const result = vehicleFormSchema.safeParse({ ...filled, [field]: value });
  expect(result.error?.issues[0].path[0]).toBe(field);
});

test('round-trips an existing vehicle into form values', () => {
  const form = vehicleToForm({
    model: { id: filled.modelId },
    plateNumber: '1กข1234',
    plateProvince: 'กรุงเทพมหานคร',
    vin: null,
    color: 'ขาว',
    mileageKm: 25000,
    location: { lat: 13.75, lng: 100.53 },
    pickupAddress: null,
    dailyPrice: 120050,
    description: null,
  });
  expect(form).toMatchObject({
    dailyPriceBaht: '1200.50',
    mileageKm: '25000',
    color: 'ขาว',
    vin: '',
  });
});
