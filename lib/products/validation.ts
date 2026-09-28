import type { EventBriefDocument } from "@/lib/content/brief";
import type { ProductPresentation } from "@/lib/products/presentation";

type BriefIssue = { section: "schedule"; path: string; message: string };

export function weddingProductBriefIssues(document: EventBriefDocument): BriefIssue[] {
  if (document.event.type !== "wedding") return [{ section: "schedule", path: "event.type", message: "A wedding brief is required." }];
  const kinds = new Set(document.event.activities.map((activity) => activity.kind));
  const issues: BriefIssue[] = [];
  if (!kinds.has("ceremony")) issues.push({ section: "schedule", path: "event.activities.ceremony", message: "Add a ceremony with its time and venue." });
  if (!kinds.has("reception")) issues.push({ section: "schedule", path: "event.activities.reception", message: "Add a reception with its time and venue." });
  return issues;
}

export function weddingProductReviewFitIssues(document: EventBriefDocument, fit: ProductPresentation["fit"]) {
  if (document.event.type !== "wedding") return [];
  const issues: Array<{ section: "identity" | "schedule"; path: string; message: string }> = [];
  const displayNames = document.weddingDetails?.preferredNames ?? ["", ""];
  document.event.partners.forEach((partner, index) => {
    const name = displayNames[index]?.trim() || partner.displayName.trim();
    const length = Array.from(name).length;
    if (length > 72) issues.push({ section: "identity", path: `event.partners.${index}.displayName`, message: `Partner ${index + 1} display name is too long for this design. Agree on a shorter display name before review.` });
    else if (length > 36 && fit !== "compact") issues.push({ section: "identity", path: `event.partners.${index}.displayName`, message: `Partner ${index + 1} display name needs the compact fit preset.` });
  });
  document.event.activities.forEach((activity, index) => {
    if (activity.kind !== "ceremony" && activity.kind !== "reception") return;
    const length = Array.from(activity.venueName.trim()).length;
    if (length > 110) issues.push({ section: "schedule", path: `event.activities.${index}.venueName`, message: `${activity.kind === "ceremony" ? "Ceremony" : "Reception"} venue label is too long for this design. Agree on a shorter display label; keep the full address below.` });
    else if (length > 70 && fit !== "compact") issues.push({ section: "schedule", path: `event.activities.${index}.venueName`, message: `${activity.kind === "ceremony" ? "Ceremony" : "Reception"} venue label needs the compact fit preset.` });
  });
  return issues;
}
