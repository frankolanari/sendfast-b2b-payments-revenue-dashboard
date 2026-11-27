-- Database roles (PLAN.md Section 2, D12; cloud-ready rule 4). Idempotent: safe to rerun.
-- Run as the database owner with psql, passing the passwords as variables (never stored here):
--   psql -v ON_ERROR_STOP=1 -v transformer_password=... -v bi_reader_password=... \
--        -v conformance_password=... -f deploy/sql/roles.sql
-- Locally: make db-roles. Rerun after every raw reload: a reload recreates the raw tables.
--
--   role         reads                                   writes
--   transformer  raw schemas, staging, intermediate,     staging, intermediate, analytics
--                analytics
--   bi_reader    analytics (marts) only                  nothing
--   conformance  raw schemas + all analytics schemas     nothing

set client_min_messages = warning;

-- 1. Roles
select format('create role %I login', role_name)
from unnest(array['transformer', 'bi_reader', 'conformance']) as roles (role_name)
where not exists (select 1 from pg_roles where rolname = role_name)
\gexec

alter role transformer with login password :'transformer_password';
alter role bi_reader with login password :'bi_reader_password';
alter role conformance with login password :'conformance_password';

-- 2. UTC everywhere (D15); nothing in public (Section 2A, rule 3)
select format('alter database %I set timezone to %L', current_database(), 'UTC')
\gexec
revoke create on schema public from public;

-- 3. Schemas dbt builds: owned by transformer
create schema if not exists staging authorization transformer;
create schema if not exists intermediate authorization transformer;
create schema if not exists analytics authorization transformer;
alter schema staging owner to transformer;
alter schema intermediate owner to transformer;
alter schema analytics owner to transformer;

-- 4. Raw schemas (landed upstream): read-only for transformer and conformance
select format('grant usage on schema %I to transformer, conformance', nspname)
from pg_namespace
where nspname in ('crm_hubspot', 'crm_salesforce', 'billing', 'ledger', 'rates')
\gexec
select format('grant select on all tables in schema %I to transformer, conformance', nspname)
from pg_namespace
where nspname in ('crm_hubspot', 'crm_salesforce', 'billing', 'ledger', 'rates')
\gexec

-- 5. bi_reader (the dashboard server): the marts only
grant usage on schema analytics to bi_reader;
grant select on all tables in schema analytics to bi_reader;
alter default privileges for role transformer in schema analytics grant select on tables to bi_reader;

-- 6. conformance: every analytics schema, read-only
grant usage on schema staging, intermediate, analytics to conformance;
grant select on all tables in schema staging, intermediate, analytics to conformance;
alter default privileges for role transformer in schema staging, intermediate, analytics
grant select on tables to conformance;
