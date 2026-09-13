export type DemoJob = { number: string; customer: string; event: string; state: string; due: string; next: string; progress: number };

export const demoJobs: DemoJob[] = [
  { number: "JO-2026-000127", customer: "Isabella Reyes", event: "Wedding", state: "IN_PRODUCTION", due: "Sep 02", next: "Finish mobile composition", progress: 78 },
  { number: "JO-2026-000128", customer: "Marissa Lim", event: "Christening", state: "READY", due: "Sep 08", next: "Assign designer", progress: 55 },
  { number: "JO-2026-000129", customer: "Lucia Navarro", event: "Birthday", state: "IN_REVIEW", due: "Sep 11", next: "Waiting for client", progress: 86 },
  { number: "JO-2026-000130", customer: "Amara Santos", event: "Debut", state: "COLLECTING", due: "Sep 18", next: "18 candles incomplete", progress: 42 },
];
