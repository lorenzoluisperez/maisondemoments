export type WeddingShowcaseScene = {
  id: "invitation" | "bookshop" | "proposal" | "venue" | "celebration" | "entourage" | "program" | "rsvp";
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
  ceremony: { time: string; venue: string; address: string; mapUrl?: string };
  reception: { time: string; venue: string; address: string };
  palette: Array<{ name: string; color: string }>;
  entourage: Array<{ id: string; title: string; members: string[]; optional?: boolean }>;
  entourageNote: string;
  program: Array<{ time: string; title: string; detail?: string }>;
  programNote: string;
  scenes: WeddingShowcaseScene[];
};

export const weddingShowcase: WeddingShowcaseFixture = {
  couple: { first: "Lorenzo", second: "Cham", monogram: "L & C" },
  dateIso: "2027-06-14T16:00:00+08:00",
  dateLabel: "Monday, 14 June 2027",
  rsvpDeadline: "30 April 2027",
  ceremony: {
    time: "4:00 in the afternoon",
    venue: "Amihan Garden Pavilion",
    address: "Tagaytay City, Cavite, Philippines",
  },
  reception: {
    time: "6:30 in the evening",
    venue: "Hiraya Garden Hall",
    address: "Tagaytay City, Cavite, Philippines",
  },
  palette: [
    { name: "Olive", color: "#3f4a32" },
    { name: "Rose", color: "#c9a09a" },
    { name: "Terracotta", color: "#b8755b" },
    { name: "Champagne", color: "#c8b99c" },
  ],
  entourage: [
    {
      id: "parents",
      title: "Parents",
      members: [
        "Lorenzo’s parents · Rafael and Elena Mendoza",
        "Cham’s parents · Arturo and Teresa Reyes",
      ],
    },
    {
      id: "principal-sponsors",
      title: "Principal Sponsors",
      members: [
        "Atty. Gabriel and Marisol Dela Cruz",
        "Dr. Mateo and Beatriz Santos",
        "Mr. Joaquin and Elena Navarro",
        "Mr. Andres and Lucia Villanueva",
      ],
    },
    {
      id: "honor-attendants",
      title: "Best Man and Maid of Honor",
      members: ["Best Man · Nico Mendoza", "Maid of Honor · Lia Reyes"],
    },
    {
      id: "secondary-sponsors",
      title: "Secondary Sponsors",
      optional: true,
      members: [
        "Candle Sponsors · Paolo and Mira Flores",
        "Veil Sponsors · Enzo and Clara Garcia",
        "Cord Sponsors · Rafael and Sofia Lim",
      ],
    },
    {
      id: "bridal-party",
      title: "Bridesmaids and Groomsmen",
      members: [
        "Bridesmaid · Amara Cruz",
        "Bridesmaid · Isabel Santiago",
        "Bridesmaid · Elena Bautista",
        "Groomsman · Tomas Villanueva",
        "Groomsman · Miguel Navarro",
        "Groomsman · Daniel Santos",
      ],
    },
    { id: "bearers", title: "Bearers", members: [], optional: true },
    { id: "flower-girls", title: "Flower Girls", members: [], optional: true },
  ],
  entourageNote: "Names are fictional sample entries for this invitation demo.",
  program: [
    { time: "3:30 PM", title: "Guest arrival", detail: "Welcome and garden seating" },
    { time: "4:00 PM", title: "Processional and ceremony" },
    { time: "5:15 PM", title: "Garden cocktails" },
    { time: "6:30 PM", title: "Reception entrance" },
    { time: "7:00 PM", title: "Dinner and toasts" },
    { time: "8:00 PM", title: "First dance" },
    { time: "8:30 PM", title: "Cake cutting" },
    { time: "9:00 PM", title: "Dancing" },
  ],
  programNote: "Sample times for a flexible ceremony and reception celebration.",
  scenes: [
    { id: "invitation", eyebrow: "Together with their families", title: "We invite you to our wedding", copy: "A new chapter begins among the gardens and hills of Tagaytay." },
    { id: "bookshop", eyebrow: "Chapter one · How we met", title: "Good stories find their people", copy: "Two curious souls, one quiet bookshop, and a conversation neither of us wanted to end.", image: "/wedding-showcase/bookshop.webp" },
    { id: "proposal", eyebrow: "Chapter two · And then you", title: "You made ordinary days extraordinary", copy: "Somewhere between shared pages and faraway places, forever began to feel like home.", image: "/wedding-showcase/proposal.webp" },
    { id: "venue", eyebrow: "Chapter three · The place", title: "A beautiful setting for our next chapter", copy: "A garden ceremony, the cool Tagaytay breeze, and a view across Taal Lake.", image: "/wedding-showcase/tagaytay-garden-watercolor-v1.webp" },
    { id: "celebration", eyebrow: "The celebration", title: "Join us in Tagaytay", copy: "Come for the vows. Stay for dinner, dancing, and the people we love most." },
    { id: "entourage", eyebrow: "With love and gratitude", title: "The people beside us", copy: "We are grateful to share this day with the family and friends who have carried us here." },
    { id: "program", eyebrow: "A day together", title: "A few moments to look forward to", copy: "Join us from the first welcome through a night of dinner and dancing." },
    { id: "rsvp", eyebrow: "Kindly reply", title: "Will you celebrate with us?", copy: "This sample RSVP is for demonstration only and does not submit any information." },
  ],
};
