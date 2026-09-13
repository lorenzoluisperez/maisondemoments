import { describe, expect, it } from "vitest";
import { assertAllocatedSlots, isRsvpOpen, rsvpSubmissionSchema } from "@/lib/domain/rsvp";

const adultSlot = "30000000-0000-4000-8000-000000000001";

describe("RSVP rules", () => {
  it("requires an allocated slot for attending responses", () => {
    const result = rsvpSubmissionSchema.safeParse({
      status: "ATTENDING", selectedSlotIds: [], expectedRevision: 0, invitationVersion: 1,
      idempotencyKey: "40000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects seats from another household", () => {
    expect(() => assertAllocatedSlots([adultSlot], [])).toThrow(/outside this household/);
  });

  it("enforces the local event deadline", () => {
    expect(isRsvpOpen("2026-09-13", new Date("2026-09-13T15:59:00Z"), "Asia/Manila")).toBe(true);
    expect(isRsvpOpen("2026-09-13", new Date("2026-09-13T16:01:00Z"), "Asia/Manila")).toBe(false);
  });
});
