"use client";

import type { ReactNode } from "react";
import type { InvitationRenderModel } from "@/lib/media/types";
import { weddingFixtureFromSnapshot } from "@/lib/products/fixture";
import { originalProductPresentation, productAccentStyle } from "@/lib/products/presentation";
import { WeddingShowcase } from "@/components/demo/wedding-showcase";
import { BeachWeddingShowcase } from "@/components/demo/beach-wedding-showcase";
import { BridgertonWeddingShowcase } from "@/components/demo/bridgerton-wedding-showcase";
import { TheatricalInvitation } from "@/components/invitation/theatrical-invitation";

export function ProductInvitation({ snapshot, rsvpContent, editing = false }: { snapshot: InvitationRenderModel; rsvpContent?: ReactNode; editing?: boolean }) {
  if (!snapshot.product) return <TheatricalInvitation snapshot={snapshot} rsvpContent={rsvpContent} />;
  const fixture = weddingFixtureFromSnapshot(snapshot);
  const reply = rsvpContent ?? <p>Private household replies become available after publication.</p>;
  const gallery = snapshot.renderMedia?.gallery;
  const presentation = snapshot.config.productPresentation ?? originalProductPresentation;
  const accentStyle = productAccentStyle(snapshot.product.slug, presentation);
  if (snapshot.product.slug === "coastal-romance") return <BeachWeddingShowcase fixture={fixture} rsvpContent={reply} gallery={gallery} editing={editing} presentation={presentation} accentStyle={accentStyle} />;
  if (snapshot.product.slug === "heritage-romance") return <BridgertonWeddingShowcase fixture={fixture} rsvpContent={reply} gallery={gallery} editing={editing} presentation={presentation} accentStyle={accentStyle} />;
  return <WeddingShowcase fixture={fixture} rsvpContent={reply} gallery={gallery} editing={editing} presentation={presentation} accentStyle={accentStyle} />;
}
