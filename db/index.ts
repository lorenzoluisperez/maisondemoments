import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for database-backed operations");
  client ??= postgres(databaseUrl, { prepare: false, max: 4, idle_timeout: 20 });
  return drizzle(client, { schema });
}
