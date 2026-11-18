import type { VehicleStatus } from '@haupcar/shared';
import { ConflictException } from '@nestjs/common';

type Actor = 'owner' | 'admin' | 'system';

// The only place allowed status changes are defined.
const TRANSITIONS: Record<Actor, Partial<Record<VehicleStatus, VehicleStatus[]>>> = {
  owner: { draft: ['pending_review'], rejected: ['pending_review'] },
  admin: {
    pending_review: ['approved', 'rejected'],
    approved: ['suspended'],
    suspended: ['approved'], // reinstate
  },
  system: { approved: ['pending_review'] }, // key fields edited after approval
};

export function assertTransition(from: VehicleStatus, to: VehicleStatus, actor: Actor) {
  if (!TRANSITIONS[actor][from]?.includes(to)) {
    throw new ConflictException(`${actor} cannot change status from ${from} to ${to}`);
  }
}

/** Fields an admin checked at approval; changing any of them needs a new review. */
const KEY_FIELDS = ['plateNumber', 'plateProvince', 'vin', 'modelId'] as const;

export function requiresReReview(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
) {
  return KEY_FIELDS.some((f) => f in changes && changes[f] !== current[f]);
}
