export type WeddingShowcaseScene = {
  id: "invitation" | "bookshop" | "proposal" | "venue" | "celebration" | "rsvp";
  eyebrow: string;
  title: string;
  copy: string;
  image?: string;
};

export type WeddingShowcaseFixture = {
  couple: { first: string; second: string; monogram: string };
  dateIso: string;
  dateLabel: string;
  rsvpDeadline: string;
  ceremony: { time: string; venue: string; address: string; mapUrl: string };
  reception: { time: string; venue: string; address: string };
  palette: Array<{ name: string; color: string }>;
  scenes: WeddingShowcaseScene[];
};

export const weddingShowcase: WeddingShowcaseFixture = {
  couple: { first: "Lorenzo", second: "Cham", monogram: "L & C" },
  dateIso: "2027-06-14T16:00:00+02:00",
  dateLabel: "Monday, 14 June 2027",
  rsvpDeadline: "30 April 2027",
  ceremony: {
    time: "4:00 in the afternoon",
    venue: "Villa Serenità",
    address: "Val d’Orcia, Tuscany, Italy",
    mapUrl: "https://maps.google.com/?q=Val+d%27Orcia+Tuscany+Italy",
  },
  reception: {
    time: "6:30 in the evening",
    venue: "The Olive Garden",
    address: "Dinner and dancing under the stars",
  },
  palette: [
    { name: "Olive", color: "#3f4a32" },
    { name: "Rose", color: "#c9a09a" },
    { name: "Terracotta", color: "#b8755b" },
    { name: "Champagne", color: "#c8b99c" },
  ],
  scenes: [
    { id: "invitation", eyebrow: "Together with their families", title: "We invite you to our wedding", copy: "A new chapter begins beneath the Tuscan sun." },
    { id: "bookshop", eyebrow: "Chapter one · How we met", title: "Good stories find their people", copy: "Two curious souls, one quiet bookshop, and a conversation neither of us wanted to end.", image: "/wedding-showcase/bookshop.webp" },
    { id: "proposal", eyebrow: "Chapter two · And then you", title: "You made ordinary days extraordinary", copy: "Somewhere between shared pages and faraway places, forever began to feel like home.", image: "/wedding-showcase/proposal.webp" },
    { id: "venue", eyebrow: "Chapter three · The place", title: "A beautiful setting for our next chapter", copy: "Surrounded by olive groves, candlelight, and the people we love most.", image: "/wedding-showcase/villa.webp" },
    { id: "celebration", eyebrow: "The celebration", title: "Meet us in Tuscany", copy: "Come for the vows. Stay for dinner, dancing, and a sky full of stars." },
    { id: "rsvp", eyebrow: "Kindly reply", title: "Will you celebrate with us?", copy: "This sample RSVP is for demonstration only and does not submit any information." },
  ],
};
