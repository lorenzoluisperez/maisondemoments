export type CelebrationGroup = {
  id: "roses" | "candles" | "treasures" | "blue-bills";
  title: string;
  introduction: string;
  members: { id: string; name: string }[];
};

export type DebutFixture = {
  celebrant: string;
  monogram: string;
  hostWording: string;
  startsAt: string;
  timezone: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  address: string;
  rsvpDeadline: string;
  message: string;
  program: { time: string; title: string; detail: string }[];
  groups: CelebrationGroup[];
};

const names: Record<CelebrationGroup["id"], string[]> = {
  roses: ["Rafael Santos", "Gabriel Reyes", "Miguel Navarro", "Enzo Villanueva", "Mateo Cruz", "Nicolas Rivera", "Joaquin Mendoza", "Sebastian Lim", "Adrian Flores", "Lucas Garcia", "Marco Dela Rosa", "Andres Castillo", "Paolo Bautista", "Daniel Mercado", "Lorenzo Aquino", "Elias Santiago", "Tomas Valdez", "Antonio Santos"],
  candles: ["Sofia Reyes", "Isabella Cruz", "Camille Navarro", "Bianca Rivera", "Gabriella Lim", "Lucia Mendoza", "Clara Villanueva", "Elena Garcia", "Juliana Flores", "Patricia Dela Rosa", "Mia Castillo", "Alessandra Bautista", "Beatriz Mercado", "Natalia Aquino", "Francesca Santiago", "Victoria Valdez", "Celine Torres", "Celeste Santos"],
  treasures: ["Teresa Santos", "Ramon Reyes", "Carmen Navarro", "Eduardo Cruz", "Maribel Rivera", "Roberto Lim", "Diana Mendoza", "Fernando Villanueva", "Lourdes Garcia", "Ricardo Flores", "Angela Dela Rosa", "Ernesto Castillo", "Cristina Bautista", "Alfredo Mercado", "Rosario Aquino", "Vicente Santiago", "Pilar Valdez", "Emilia Torres"],
  "blue-bills": ["Arturo Santos", "Mercedes Reyes", "Francisco Navarro", "Leonora Cruz", "Manuel Rivera", "Corazon Lim", "Alberto Mendoza", "Estela Villanueva", "Jaime Garcia", "Aurora Flores", "Renato Dela Rosa", "Consuelo Castillo", "Oscar Bautista", "Milagros Mercado", "Benito Aquino", "Gloria Santiago", "Salvador Valdez", "Remedios Torres"],
};

export const debutPearl: DebutFixture = {
  celebrant: "Amara Santos", monogram: "AS",
  hostWording: "Together with her loving family",
  startsAt: "2027-11-08T17:30:00+08:00", timezone: "Asia/Manila",
  dateLabel: "8 November 2027", timeLabel: "5:30 in the evening",
  venue: "The Pearl Conservatory", address: "Makati City, Philippines · Imagined venue",
  rsvpDeadline: "25 October 2027",
  message: "To the people who have filled my years with love, laughter, and little lessons: this evening is for us. As I turn the page to eighteen, I would be delighted to have you beside me, celebrating everything that has been and all that is still to come.",
  program: [
    { time: "5:30 PM", title: "A warm welcome", detail: "Arrival, refreshments, and a little catching up" },
    { time: "6:00 PM", title: "Her beautiful beginning", detail: "Amara’s entrance and a welcome from her family" },
    { time: "6:20 PM", title: "At the table", detail: "Dinner shared with our favorite people" },
    { time: "7:00 PM", title: "18 Roses", detail: "A dance for every cherished connection" },
    { time: "7:30 PM", title: "18 Candles", detail: "Memories, wishes, and words to carry forward" },
    { time: "8:10 PM", title: "18 Treasures", detail: "Thoughtful keepsakes and the stories they hold" },
    { time: "8:40 PM", title: "18 Blue Bills", detail: "Kind wishes and gifts for the chapter ahead" },
    { time: "9:00 PM", title: "A wish, then a waltz", detail: "Birthday cake, a thank-you, and an evening of dancing" },
  ],
  groups: ([
    ["roses", "18 Roses", "For the people who have walked beside me, a rose and a dance to remember."],
    ["candles", "18 Candles", "Eighteen little lights, each carrying a memory, a wish, and a little wisdom."],
    ["treasures", "18 Treasures", "Keepsakes chosen with love, holding stories I will treasure long after tonight."],
    ["blue-bills", "18 Blue Bills", "With gratitude to those sharing kind wishes and gifts for my next chapter."],
  ] as const).map(([id, title, introduction]) => ({ id, title, introduction, members: names[id].map((name, index) => ({ id: `${id}-${index + 1}`, name })) })),
};
