import type {
  CarModel,
  CreateVehicleInput,
  DocumentType,
  UpdateVehicleInput,
  Vehicle,
  VehiclePage,
  VehicleStatus,
} from '@haupcar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: (page: number, status?: VehicleStatus) =>
    ['vehicles', 'list', page, status ?? 'all'] as const,
  detail: (id: string) => ['vehicles', 'detail', id] as const,
};

export function useMyVehicles(page: number, status?: VehicleStatus) {
  const qs = new URLSearchParams({ page: String(page), ...(status && { status }) });
  return useQuery({
    queryKey: vehicleKeys.list(page, status),
    queryFn: () => api<VehiclePage>(`/vehicles?${qs}`),
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: vehicleKeys.detail(id),
    queryFn: () => api<Vehicle>(`/vehicles/${id}`),
  });
}

export function useCarModels() {
  return useQuery({
    queryKey: ['car-models'],
    queryFn: () => api<CarModel[]>('/car-models'),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Every vehicle mutation returns or changes a vehicle: refresh its detail and the lists. */
function useVehicleMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  vehicleId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const vehicle = result as Partial<Vehicle> | undefined;
      if (vehicle?.id && vehicle.plateNumber)
        queryClient.setQueryData(vehicleKeys.detail(vehicle.id), vehicle);
      else if (vehicleId)
        queryClient.invalidateQueries({ queryKey: vehicleKeys.detail(vehicleId) });
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'list'] });
    },
  });
}

export const useCreateVehicle = () =>
  useVehicleMutation((body: CreateVehicleInput) =>
    api<Vehicle>('/vehicles', { method: 'POST', body }),
  );

export const useUpdateVehicle = (id: string) =>
  useVehicleMutation((body: UpdateVehicleInput) =>
    api<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body }),
  );

export const useSubmitVehicle = (id: string) =>
  useVehicleMutation(() => api<Vehicle>(`/vehicles/${id}/submit`, { method: 'POST' }));

export const useDeleteVehicle = (id: string) =>
  useVehicleMutation(() => api(`/vehicles/${id}`, { method: 'DELETE' }));

export const useUploadPhoto = (vehicleId: string) =>
  useVehicleMutation((file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api(`/vehicles/${vehicleId}/photos`, { method: 'POST', form });
  }, vehicleId);

export const useDeletePhoto = (vehicleId: string) =>
  useVehicleMutation(
    (photoId: string) => api(`/vehicles/${vehicleId}/photos/${photoId}`, { method: 'DELETE' }),
    vehicleId,
  );

export const useUploadDocument = (vehicleId: string) =>
  useVehicleMutation(
    ({ type, file, expiresOn }: { type: DocumentType; file: File; expiresOn?: string }) => {
      const form = new FormData();
      form.append('type', type);
      if (expiresOn) form.append('expiresOn', expiresOn);
      form.append('file', file);
      return api(`/vehicles/${vehicleId}/documents`, { method: 'POST', form });
    },
    vehicleId,
  );

export const useDeleteDocument = (vehicleId: string) =>
  useVehicleMutation(
    (documentId: string) =>
      api(`/vehicles/${vehicleId}/documents/${documentId}`, { method: 'DELETE' }),
    vehicleId,
  );
