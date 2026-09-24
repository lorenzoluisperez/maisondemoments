import { weddingShowcase, type WeddingShowcaseFixture } from "./wedding-showcase";

// A separate fictional Boracay commission using the same people, date, guests,
// schedule, and RSVP deadline as the original wedding demo.
export const beachWeddingShowcase: WeddingShowcaseFixture = {
  ...weddingShowcase,
  ceremony: {
    ...weddingShowcase.ceremony,
    venue: "Amihan Beach Pavilion",
    address: "Boracay Island, Malay, Aklan, Philippines",
  },
  reception: {
    ...weddingShowcase.reception,
    venue: "Hiraya Shore Hall",
    address: "Boracay Island, Malay, Aklan, Philippines",
  },
  program: weddingShowcase.program.map((item) => item.title === "Guest arrival" ? { ...item, detail: "Welcome and seaside seating" } : item),
  scenes: weddingShowcase.scenes.map((scene) => {
    switch (scene.id) {
      case "invitation": return { ...scene, copy: "A new chapter begins beside the sea in Boracay." };
      case "venue": return { ...scene, copy: "A shoreline ceremony, the warm Boracay breeze, and the sea stretching into the evening.", image: undefined };
      case "celebration": return { ...scene, title: "Join us in Boracay" };
      default: return scene;
    }
  }),
};
