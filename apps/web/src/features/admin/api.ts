import type {
  AdminVehicleDetail,
  AdminVehiclePage,
  SetStatusInput,
  VehicleStatus,
} from '@haupcar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAdminVehicles(page: number, status: VehicleStatus | undefined) {
  // The review queue is first-come first-served; other views show recent activity first.
  const order = status === 'pending_review' ? 'oldest' : 'newest';
  const qs = new URLSearchParams({ page: String(page), order, ...(status && { status }) });
  return useQuery({
    queryKey: ['admin', 'vehicles', page, status ?? 'all'],
    queryFn: () => api<AdminVehiclePage>(`/admin/vehicles?${qs}`),
  });
}

export function useAdminVehicle(id: string) {
  return useQuery({
    queryKey: ['admin', 'vehicle', id],
    queryFn: () => api<AdminVehicleDetail>(`/admin/vehicles/${id}`),
  });
}

export function useSetStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetStatusInput) =>
      api<AdminVehicleDetail>(`/admin/vehicles/${id}/status`, { method: 'POST', body }),
    onSuccess: (vehicle) => {
      queryClient.setQueryData(['admin', 'vehicle', id], vehicle);
      queryClient.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    },
    // Someone else acted (or the owner edited) since this page loaded: show the current state.
    onError: () => queryClient.invalidateQueries({ queryKey: ['admin', 'vehicle', id] }),
  });
}
