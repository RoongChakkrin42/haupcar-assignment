import type { AdminVehicleDetail } from '@haupcar/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { server } from '@/test-setup';
import { DecisionPanel } from './decision-panel';

const vehicle = (status: AdminVehicleDetail['status']) =>
  ({
    id: 'v1',
    status,
    version: 7,
    owner: { id: 'o1', name: 'Somchai', email: 'o@test.local', phone: null },
  }) as AdminVehicleDetail;

function setup(status: AdminVehicleDetail['status']) {
  const sent: unknown[] = [];
  server.use(
    http.post('/api/v1/admin/vehicles/v1/status', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({ ...vehicle('approved'), history: [] });
    }),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DecisionPanel vehicle={vehicle(status)} />
    </QueryClientProvider>,
  );
  return sent;
}

test('approves a pending vehicle with the reviewed version', async () => {
  const sent = setup('pending_review');
  await userEvent.click(screen.getByRole('button', { name: 'อนุมัติ' }));
  await waitFor(() => expect(sent).toEqual([{ status: 'approved', version: 7 }]));
});

test('needs a reason before rejecting', async () => {
  const sent = setup('pending_review');
  await userEvent.click(screen.getByRole('button', { name: 'ไม่อนุมัติ' }));
  expect(await screen.findByText('บอกเหตุผลให้เจ้าของรถรู้ว่าต้องแก้อะไร')).toBeInTheDocument();
  expect(sent).toEqual([]);

  await userEvent.type(screen.getByLabelText('เหตุผล (เจ้าของรถจะเห็น)'), 'เล่มทะเบียนไม่ชัด');
  await userEvent.click(screen.getByRole('button', { name: 'ไม่อนุมัติ' }));
  await waitFor(() =>
    expect(sent).toEqual([{ status: 'rejected', reason: 'เล่มทะเบียนไม่ชัด', version: 7 }]),
  );
});

test('offers suspend for approved vehicles and reinstate for suspended ones', () => {
  setup('approved');
  expect(screen.getByRole('button', { name: 'ระงับชั่วคราว' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'อนุมัติ' })).not.toBeInTheDocument();
});

test('offers reinstate for suspended vehicles', () => {
  setup('suspended');
  expect(screen.getByRole('button', { name: 'เปิดให้เช่าอีกครั้ง' })).toBeInTheDocument();
});

test('has nothing to decide on drafts', () => {
  setup('draft');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
