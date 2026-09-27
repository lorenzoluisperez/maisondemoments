export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
};

export function getCountdownParts(targetIso: string, now: number): CountdownParts {
  const distance = Math.max(0, Date.parse(targetIso) - now);
  if (!Number.isFinite(distance)) throw new Error("Invalid countdown target");
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor(distance / 3_600_000) % 24,
    minutes: Math.floor(distance / 60_000) % 60,
    seconds: Math.floor(distance / 1000) % 60,
    complete: distance === 0,
  };
}
