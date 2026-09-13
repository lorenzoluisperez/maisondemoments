import type { InvitationSnapshot } from "@/lib/invitation/config";

export type SnapshotMediaReference = { mediaId: string; alt: string };

export type ResolvedMediaAsset = {
  mediaId: string;
  alt: string;
  width: number;
  height: number;
  sources: Array<{ src: string; width: number; height: number; contentType: string }>;
};

export type InvitationRenderModel = InvitationSnapshot & {
  renderMedia?: { gallery: ResolvedMediaAsset[] };
};
