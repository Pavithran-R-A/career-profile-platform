-- Pre-domain least-privilege hardening.
-- Anonymous users never access application tables directly; public profile reads
-- are served by the Worker through server-only projections.
-- Authenticated application traffic does not need structural table privileges.

revoke all privileges on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges in schema public revoke all privileges on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
