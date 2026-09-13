export const productionStates = ["NEW", "COLLECTING", "READY", "IN_PRODUCTION", "DELIVERED", "CLOSED", "CANCELLED"] as const;
export type ProductionState = (typeof productionStates)[number];

export const reviewStates = ["EDITING", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"] as const;
export type ReviewState = (typeof reviewStates)[number];

export const availabilityStates = ["UNPUBLISHED", "LIVE", "SUSPENDED", "EXPIRED", "REMOVED"] as const;
export type AvailabilityState = (typeof availabilityStates)[number];

const productionTransitions: Record<ProductionState, readonly ProductionState[]> = {
  NEW: ["COLLECTING", "CANCELLED"],
  COLLECTING: ["READY", "CANCELLED"],
  READY: ["IN_PRODUCTION", "COLLECTING", "CANCELLED"],
  IN_PRODUCTION: ["DELIVERED", "READY", "CANCELLED"],
  DELIVERED: ["CLOSED", "IN_PRODUCTION"],
  CLOSED: [],
  CANCELLED: [],
};

const reviewTransitions: Record<ReviewState, readonly ReviewState[]> = {
  EDITING: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: ["EDITING"],
  APPROVED: ["EDITING"],
};

const availabilityTransitions: Record<AvailabilityState, readonly AvailabilityState[]> = {
  UNPUBLISHED: ["LIVE", "REMOVED"],
  LIVE: ["SUSPENDED", "EXPIRED", "REMOVED"],
  SUSPENDED: ["LIVE", "EXPIRED", "REMOVED"],
  EXPIRED: ["LIVE", "REMOVED"],
  REMOVED: [],
};

export class InvalidStateTransitionError extends Error {}

export function assertTransition<T extends string>(from: T, to: T, transitions: Record<T, readonly T[]>) {
  if (!transitions[from].includes(to)) throw new InvalidStateTransitionError(`Cannot transition from ${from} to ${to}`);
}

export const assertProductionTransition = (from: ProductionState, to: ProductionState) => assertTransition(from, to, productionTransitions);
export const assertReviewTransition = (from: ReviewState, to: ReviewState) => assertTransition(from, to, reviewTransitions);
export const assertAvailabilityTransition = (from: AvailabilityState, to: AvailabilityState) => assertTransition(from, to, availabilityTransitions);
