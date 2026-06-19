-- Migration: Add TARIC commodity code fields to machines table
-- Run this in Supabase SQL Editor

alter table machines
  add column if not exists taric_code        varchar(10),
  add column if not exists taric_validated   boolean default false,
  add column if not exists taric_description text,
  add column if not exists taric_checked_at  timestamptz;

-- Optional: index for filtering machines with/without TARIC validation
create index if not exists idx_machines_taric_code on machines(taric_code) where taric_code is not null;
