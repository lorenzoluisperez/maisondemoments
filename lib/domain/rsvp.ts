import { z } from "zod";

export const rsvpSubmissionSchema = z.object({
  status: z.enum(["ATTENDING", "DECLINED"]),
  selectedSlotIds: z.array(z.string().uuid()).max(20),
  expectedRevision: z.number().int().min(0),
  invitationVersion: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid(),
}).strict().superRefine((value, context) => {
  if (value.status === "ATTENDING" && value.selectedSlotIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSlotIds"], message: "Select at least one allocated guest slot" });
  }
  if (value.status === "DECLINED" && value.selectedSlotIds.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSlotIds"], message: "A declined RSVP cannot include attendees" });
  }
  if (new Set(value.selectedSlotIds).size !== value.selectedSlotIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSlotIds"], message: "Guest slots must be unique" });
  }
});

export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>;

export function assertAllocatedSlots(selectedSlotIds: string[], allocatedSlotIds: string[]) {
  const allocated = new Set(allocatedSlotIds);
  if (selectedSlotIds.some((slotId) => !allocated.has(slotId))) {
    throw new Error("RSVP contains a guest slot outside this household");
  }
}

export function isRsvpOpen(deadline: string, now: Date, timezone: string) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return localDate <= deadline;
}
