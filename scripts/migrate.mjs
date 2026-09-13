import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;

if (!migrationUrl) {
  throw new Error("MIGRATION_DATABASE_URL is required");
}

const client = postgres(migrationUrl, {
  connect_timeout: 10,
  idle_timeout: 5,
  max: 1,
  prepare: false,
});

try {
  await migrate(drizzle(client), { migrationsFolder: resolve("drizzle") });
  console.log("Database migrations are current");
} finally {
  await client.end({ timeout: 5 });
}
