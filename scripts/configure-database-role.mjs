import postgres from "postgres";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!migrationUrl || !applicationUrl) {
  throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL are required");
}

const applicationPassword = decodeURIComponent(new URL(applicationUrl).password);

if (!/^[A-Za-z0-9_-]{32,}$/.test(applicationPassword)) {
  throw new Error("The application database password must be at least 32 URL-safe characters");
}

const client = postgres(migrationUrl, {
  connect_timeout: 10,
  idle_timeout: 5,
  max: 1,
  prepare: false,
});

try {
  await client.unsafe(`ALTER ROLE maison_app LOGIN PASSWORD '${applicationPassword}'`);
  console.log("Application database role configured");
} finally {
  await client.end({ timeout: 5 });
}
