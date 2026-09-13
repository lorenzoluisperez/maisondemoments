import { describe, expect, it } from "vitest";
import { assertAvailabilityTransition, assertProductionTransition, assertReviewTransition, InvalidStateTransitionError } from "@/lib/domain/state-machines";

describe("business state machines", () => {
  it("allows the intended happy path", () => {
    expect(() => assertProductionTransition("NEW", "COLLECTING")).not.toThrow();
    expect(() => assertReviewTransition("IN_REVIEW", "APPROVED")).not.toThrow();
    expect(() => assertAvailabilityTransition("UNPUBLISHED", "LIVE")).not.toThrow();
  });

  it("blocks unsupported state jumps", () => {
    expect(() => assertProductionTransition("NEW", "DELIVERED")).toThrow(InvalidStateTransitionError);
    expect(() => assertReviewTransition("EDITING", "APPROVED")).toThrow(InvalidStateTransitionError);
    expect(() => assertAvailabilityTransition("REMOVED", "LIVE")).toThrow(InvalidStateTransitionError);
  });
});
