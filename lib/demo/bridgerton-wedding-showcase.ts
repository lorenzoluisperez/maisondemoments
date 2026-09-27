import { weddingShowcase, type WeddingShowcaseFixture } from "./wedding-showcase";

// A separate fictional Intramuros commission that retains the original event facts.
export const bridgertonWeddingShowcase: WeddingShowcaseFixture = {
  ...weddingShowcase,
  ceremony: {
    ...weddingShowcase.ceremony,
    venue: "Amihan Courtyard",
    address: "Intramuros, Manila, Philippines",
  },
  reception: {
    ...weddingShowcase.reception,
    venue: "Hiraya Heritage Hall",
    address: "Intramuros, Manila, Philippines",
  },
  program: weddingShowcase.program.map((item) => item.title === "Guest arrival"
    ? { ...item, detail: "Welcome and courtyard seating" }
    : item),
  scenes: weddingShowcase.scenes.map((scene) => {
    switch (scene.id) {
      case "invitation": return { ...scene, copy: "A new chapter begins inside the storied walls of Intramuros." };
      case "venue": return { ...scene, copy: "An old Manila courtyard, capiz-lit halls, and an evening filled with the people we love.", image: undefined };
      case "celebration": return { ...scene, title: "Join us in Intramuros" };
      default: return scene;
    }
  }),
};
