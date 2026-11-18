import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleForm } from './vehicle-form-view';

// Leaflet needs real layout; the picker is exercised in the browser (E2E).
vi.mock('@/components/map-picker', () => ({
  MapPicker: ({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 13.75, lng: 100.53 })}>
      ปักหมุดทดสอบ
    </button>
  ),
}));

const models = [
  {
    id: '3f1c2b7a-1d2e-4f5a-8b9c-0d1e2f3a4b5c',
    make: 'Honda',
    model: 'City',
    year: 2024,
    bodyType: 'sedan',
    transmission: 'automatic',
    fuel: 'petrol',
    seats: 5,
  },
] as const;

test('shows Thai errors next to the required fields', async () => {
  const onSubmit = vi.fn();
  render(<VehicleForm models={[...models]} submitLabel="บันทึก" onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

  expect(await screen.findByText('เลือกรุ่นรถ')).toBeInTheDocument();
  expect(screen.getByText('กรอกเลขทะเบียน')).toBeInTheDocument();
  expect(screen.getByText('ระบุจังหวัดของป้ายทะเบียน')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('submits the API payload with the price in satang', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<VehicleForm models={[...models]} submitLabel="บันทึก" onSubmit={onSubmit} />);

  await userEvent.selectOptions(screen.getByLabelText('รุ่นรถ'), models[0].id);
  await userEvent.type(screen.getByLabelText('เลขทะเบียน'), '1กข 1234');
  await userEvent.selectOptions(screen.getByLabelText('จังหวัด'), 'ภูเก็ต');
  await userEvent.type(screen.getByLabelText('ราคาต่อวัน (บาท)'), '1,200.50');
  await userEvent.click(screen.getByRole('button', { name: 'ปักหมุดทดสอบ' }));
  await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    modelId: models[0].id,
    plateNumber: '1กข 1234',
    plateProvince: 'ภูเก็ต',
    dailyPrice: 120050,
    location: { lat: 13.75, lng: 100.53 },
  });
});

test('shows server-side field errors on the matching inputs', async () => {
  const onSubmit = vi.fn().mockRejectedValue(
    Object.assign(new Error('Validation failed'), {
      status: 400,
      issues: [{ path: 'dailyPrice', message: 'too big' }],
    }),
  );
  render(
    <VehicleForm
      models={[...models]}
      submitLabel="บันทึก"
      onSubmit={onSubmit}
      defaultValues={{
        modelId: models[0].id,
        plateNumber: 'A1',
        plateProvince: 'ภูเก็ต',
        dailyPriceBaht: '99',
      }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
  expect(await screen.findByText('too big')).toBeInTheDocument();
});
