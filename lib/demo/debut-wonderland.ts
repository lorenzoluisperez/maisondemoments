import { debutPearl, type CelebrationGroup, type DebutFixture } from "./debut-pearl";

const introductions: Record<CelebrationGroup["id"], string> = {
  roses: "Eighteen roses, eighteen dances, and the people who make my world bloom.",
  candles: "A little light from every heart, with wishes for the adventures ahead.",
  treasures: "Little treasures, lovely stories, and keepsakes for my next chapter.",
  "blue-bills": "With love and gratitude for your kind wishes and gifts for the journey ahead.",
};

// Public storybook fixture. These people are fictional, not guest accounts or seats.
export const debutWonderland: DebutFixture = {
  celebrant: "Celeste Reyes",
  monogram: "CR",
  hostWording: "Together with her loving family",
  startsAt: "2027-08-15T18:00:00+08:00",
  timezone: "Asia/Manila",
  dateLabel: "15 August 2027",
  timeLabel: "Six o’clock in the evening",
  venue: "The Looking-Glass Conservatory",
  address: "Tagaytay, Philippines · Imagined venue",
  rsvpDeadline: "1 August 2027",
  message: "Some of the loveliest adventures begin with the people we love. As I turn eighteen, I am opening a new chapter filled with curiosity, courage, and a little wonder. Come down the garden path with me, share a story at the table, and help make this evening a memory we will keep.",
  program: [
    { time: "6:00 PM", title: "Through the garden gate", detail: "Arrival, welcome drinks, and a little catching up" },
    { time: "6:30 PM", title: "Chapter eighteen", detail: "Celeste’s entrance and a welcome from her family" },
    { time: "7:00 PM", title: "A rather lovely tea party", detail: "Dinner and stories shared around the table" },
    { time: "7:45 PM", title: "18 Roses", detail: "A rose and a dance for every cherished connection" },
    { time: "8:15 PM", title: "18 Candles", detail: "Memories, little lights, and wishes for the years ahead" },
    { time: "8:45 PM", title: "18 Treasures", detail: "Keepsakes and the stories they carry" },
    { time: "9:10 PM", title: "18 Blue Bills", detail: "Kind wishes and gifts for the next adventure" },
    { time: "9:30 PM", title: "A wish in Wonderland", detail: "Birthday cake, a thank-you, and an evening of dancing" },
  ],
  groups: debutPearl.groups.map((group) => ({
    ...group,
    introduction: introductions[group.id],
    members: group.members.map((member) => ({ ...member, id: `wonderland-${member.id}` })),
  })),
};
