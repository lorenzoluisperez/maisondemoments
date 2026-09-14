import postgres from "postgres";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!migrationUrl || !applicationUrl) {
  throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL are required");
}

const admin = postgres(migrationUrl, { max: 1, prepare: false });
const application = postgres(applicationUrl, { max: 1, prepare: false });

try {
  const [runtime] = await application`select current_user as role`;
  const [role] = await admin`
    select rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
    from pg_roles where rolname = 'maison_app'
  `;
  const [tables] = await admin`
    select count(*)::int as total, count(*) filter (where c.relrowsecurity)::int as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  `;
  const [browserGrants] = await admin`
    select count(*)::int as total
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
  `;
  const [functionGrants] = await admin`
    select count(*)::int as total
    from information_schema.routine_privileges
    where routine_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated')
  `;
  const missingIndexes = await admin`
    select conrelid::regclass::text as table_name, a.attname as fk_column
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and a.attnum = any(i.indkey)
      )
  `;
  const [migrations] = await admin`select count(*)::int as total from drizzle.__drizzle_migrations`;

  const unsafeRole = !role || role.rolsuper || role.rolcreaterole || role.rolcreatedb || role.rolreplication || role.rolbypassrls;
  if (runtime.role !== "maison_app") throw new Error(`Unexpected runtime role: ${runtime.role}`);
  if (unsafeRole) throw new Error("maison_app has elevated PostgreSQL privileges");
  if (tables.total !== 31 || tables.rls_enabled !== 31) throw new Error("Every application table must have RLS enabled");
  if (browserGrants.total !== 0) throw new Error("Browser database roles still have application table grants");
  if (functionGrants.total !== 0) throw new Error("Public database roles can execute private functions");
  if (missingIndexes.length) throw new Error("One or more foreign-key columns are missing an index");
  if (migrations.total < 9) throw new Error("Expected Phase 4 migrations are not applied");

  console.log(JSON.stringify({
    runtimeRole: runtime.role,
    migrations: migrations.total,
    applicationTables: tables.total,
    rlsEnabledTables: tables.rls_enabled,
    browserTableGrants: browserGrants.total,
    publicFunctionGrants: functionGrants.total,
    missingForeignKeyIndexes: missingIndexes.length,
  }));
} finally {
  await Promise.all([admin.end({ timeout: 5 }), application.end({ timeout: 5 })]);
}
