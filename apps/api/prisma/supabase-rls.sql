-- Idempotent RLS lockdown for Prisma-managed tables in Supabase `public` schema.
-- NestJS connects as the `postgres` role (which has BYPASSRLS) via Supavisor/Prisma,
-- while direct Supabase Data API access via `anon` and `authenticated` roles is denied.
-- Re-run this script after adding new Prisma models or resetting the database:
--   pnpm --filter @amplyra/api exec prisma db execute --file prisma/supabase-rls.sql --schema prisma/schema.prisma

DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', tbl.tablename);
  END LOOP;
END
$$;
