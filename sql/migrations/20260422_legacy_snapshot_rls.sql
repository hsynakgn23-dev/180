-- Enable RLS on legacy snapshot table to prevent public access.
-- This table is an audit snapshot from the social model v2 migration
-- and should not be publicly readable.

alter table public.rituals_legacy_social_snapshot enable row level security;

-- No public policies — only service_role (server-side) can access this table.
-- This effectively blocks all anon and authenticated client access.
