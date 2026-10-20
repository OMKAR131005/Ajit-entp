-- Field Ledger: Supabase schema (replaces the Google Sheet tabs)
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables (one per sheet tab; same column names) ----------
-- All text columns stay text (even dates) so the frontend receives exactly what it got from the Sheet.
-- `seq` keeps insertion order, like row order in a Sheet. The API hides it.

create sequence if not exists customer_seq;

create table if not exists customers (
  seq                bigserial,
  id                 text primary key,
  name               text,
  mobile             text,
  address            text,
  id_proof_type      text default '',
  id_proof_path      text default '',
  id_proof_file_name text default '',
  created_at         text default ''
);

create table if not exists leads (
  seq               bigserial,
  lead_id           text primary key,
  customer_id       text,
  fe_username       text,
  fe_name           text,
  visit_date        text,
  device_brand      text,
  device_model      text,
  expected_price    numeric default 0,
  purchase_price    numeric default 0,
  commission        numeric default 0,
  commission_amount numeric default 0,
  status            text,
  remarks           text default '',
  created_at        text default '',
  colour            text default '',
  ram               text default '',
  rom               text default '',
  accessories       text default '',
  imei1             text default '',
  updated_at        text default '',
  updated_by        text default ''
);
create index if not exists leads_customer_idx on leads (customer_id);
create index if not exists leads_fe_idx on leads (fe_username);

create table if not exists field_executives (
  seq           bigserial,
  username      text primary key,
  name          text,
  password_hash text,
  active        boolean default true
);

create table if not exists admins (
  seq           bigserial,
  username      text primary key,
  password_hash text
);

create table if not exists devices (
  id              bigserial primary key,
  brand           text,
  model           text,
  ram_options     text default '',
  storage_options text default '',
  colours         text default ''
);

create table if not exists lists (
  id      bigserial primary key,
  colours text default '',
  ram     text default '',
  storage text default ''
);

-- Replaces CacheService (login sessions + failed-login lockout)
create table if not exists sessions (
  token      text primary key,
  role       text not null,
  username   text not null,
  name       text,
  expires_at timestamptz not null
);

create table if not exists login_attempts (
  username text primary key,
  fails    int not null default 0,
  last_at  timestamptz not null default now()
);

-- ---------- Security ----------
-- RLS on with NO policies = the public anon key can read/write nothing.
-- Only the Edge Function (service role key, server side) touches these tables.
alter table customers        enable row level security;
alter table leads            enable row level security;
alter table field_executives enable row level security;
alter table admins           enable row level security;
alter table devices          enable row level security;
alter table lists            enable row level security;
alter table sessions         enable row level security;
alter table login_attempts   enable row level security;

-- ---------- Customer IDs: CUST-00001, CUST-00002 ... ----------
create or replace function next_customer_id() returns text
language sql as $$
  select 'CUST-' || lpad(nextval('customer_seq')::text, 5, '0');
$$;
revoke all on function next_customer_id() from public, anon, authenticated;

-- AFTER importing existing customers from the Sheet, run this once so new ids continue the sequence:
-- select setval('customer_seq', coalesce((select max(substring(id from '\d+$')::int) from customers), 0) + 1, false);

-- ---------- Private storage bucket for ID proofs ----------
insert into storage.buckets (id, name, public)
values ('id-proofs', 'id-proofs', false)
on conflict (id) do nothing;

-- ---------- Demo logins (same as the prototype). SKIP this block if you import
-- ---------- FieldExecutives/Admins from the Sheet; CHANGE these before real use.
-- Hash format is identical to the Apps Script one: salt$sha256(salt+password)
insert into admins (username, password_hash)
values ('admin', 'a1b2c3d4e5f60718$' || encode(extensions.digest('a1b2c3d4e5f60718' || 'admin123', 'sha256'), 'hex'))
on conflict do nothing;

insert into field_executives (username, name, password_hash, active)
select u, initcap(u),
       'f0e1d2c3b4a59687$' || encode(extensions.digest('f0e1d2c3b4a59687' || u || '123', 'sha256'), 'hex'),
       true
from unnest(array['sangewar', 'dnyaneshwar', 'harish', 'ajit']) as u
on conflict do nothing;