type LogLevel = "info" | "error";

export function operationalLog(level: LogLevel, event: string, fields: Record<string, string | number | boolean | null> = {}) {
  const entry = { timestamp: new Date().toISOString(), level, event, ...fields };
  (level === "error" ? console.error : console.info)(JSON.stringify(entry));
}
