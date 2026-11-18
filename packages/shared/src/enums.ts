// Single source for enum values: used by the DB schema (pgEnum), validation and the web app.
export const USER_ROLES = ['owner', 'admin'] as const;
export const BODY_TYPES = ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'mpv'] as const;
export const TRANSMISSIONS = ['automatic', 'manual'] as const;
export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'ev'] as const;
export const VEHICLE_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'suspended',
  'archived',
] as const;
export const DOCUMENT_TYPES = ['registration', 'insurance', 'compulsory_insurance'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
