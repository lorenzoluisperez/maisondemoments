import type { InvitationSnapshot } from "@/lib/invitation/config";
import type { WeddingShowcaseFixture } from "@/lib/demo/wedding-showcase";
import { weddingShowcase } from "@/lib/demo/wedding-showcase";
import { beachWeddingShowcase } from "@/lib/demo/beach-wedding-showcase";
import { bridgertonWeddingShowcase } from "@/lib/demo/bridgerton-wedding-showcase";

export function weddingFixtureFromSnapshot(snapshot: InvitationSnapshot): WeddingShowcaseFixture {
  if (!snapshot.product || snapshot.eventType !== "wedding") throw new Error("Wedding product snapshot required");
  const base = snapshot.product.slug === "coastal-romance" ? beachWeddingShowcase :
    snapshot.product.slug === "heritage-romance" ? bridgertonWeddingShowcase : weddingShowcase;
  const details = snapshot.product.weddingDetails;
  const first = details.preferredNames[0] || snapshot.title;
  const second = details.preferredNames[1] || snapshot.secondaryName || "";
  const monogram = details.monogram || `${Array.from(first.trim())[0] ?? ""} & ${Array.from(second.trim())[0] ?? ""}`;
  const ceremony = snapshot.activities.find((activity) => activity.kind === "ceremony") ?? snapshot.activities[0];
  const reception = snapshot.activities.find((activity) => activity.kind === "reception") ?? snapshot.activities[1];
  const chapters = details.storyChapters.length ? details.storyChapters :
    snapshot.story ? [{ title: "Our story", copy: snapshot.story }] : [];
  const storySceneIds = ["bookshop", "proposal", "venue"];
  const dateLabel = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: snapshot.product.timezone }).format(new Date(snapshot.product.dateIso));
  return {
    ...base,
    couple: { first, second, monogram },
    dateIso: snapshot.product.dateIso,
    dateLabel: snapshot.dateLabel || dateLabel,
    rsvpDeadline: snapshot.rsvpDeadlineLabel,
    ceremony: { time: ceremony?.timeLabel ?? "", venue: ceremony?.venueName ?? "", address: ceremony?.address ?? "", mapUrl: ceremony?.mapUrl },
    reception: { time: reception?.timeLabel ?? "", venue: reception?.venueName ?? "", address: reception?.address ?? "" },
    entourage: details.entourage.length ? details.entourage.map((group) => ({ ...group, optional: true })) :
      snapshot.participants.length ? [{ id: "participants", title: "Our people", members: snapshot.participants.map((person) => `${person.roleLabel} · ${person.displayName}`), optional: true }] : [],
    entourageNote: "",
    program: details.program.length ? details.program.map(({ time, title, detail }) => ({ time, title, detail })) :
      snapshot.activities.map((activity) => ({ time: activity.timeLabel, title: activity.label, detail: activity.venueName })),
    programNote: "",
    dressCode: snapshot.dressCode,
    locationLabel: ceremony?.venueName ?? "",
    storyEnabled: chapters.length > 0,
    isLive: true,
    timezone: snapshot.product.timezone,
    scenes: base.scenes.map((scene) => {
      if (scene.id === "invitation") return { ...scene, eyebrow: snapshot.hostWording, title: "Join us for our wedding", copy: "" };
      if (storySceneIds.includes(scene.id)) {
        const chapter = chapters[storySceneIds.indexOf(scene.id)];
        return { ...scene, eyebrow: chapter ? `Our story · ${storySceneIds.indexOf(scene.id) + 1}` : "", title: chapter?.title ?? "", copy: chapter?.copy ?? "" };
      }
      if (scene.id === "celebration") return { ...scene, title: "Celebrate with us", copy: `We hope you will join us on ${snapshot.dateLabel}.` };
      if (scene.id === "entourage") return { ...scene, title: "The people beside us", copy: "" };
      if (scene.id === "program") return { ...scene, title: "Our wedding day", copy: "" };
      if (scene.id === "rsvp") return { ...scene, title: "Will you celebrate with us?", copy: "Please reply for your household below." };
      return scene;
    }),
  };
}
