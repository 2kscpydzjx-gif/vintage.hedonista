-- Run once in Supabase SQL Editor before enabling the admin SEO block editor.
create table if not exists public.vh_catalog_seo_blocks (
  page_key text primary key,
  heading text not null default '',
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  image text not null default '',
  updated_at timestamptz not null default now(),
  constraint vh_catalog_seo_features_array check (jsonb_typeof(features)='array'),
  constraint vh_catalog_seo_key_check check (page_key='all' or page_key ~ '^(category|subcategory):[a-z0-9-]+(:[a-z0-9-]+)?$')
);
alter table public.vh_catalog_seo_blocks enable row level security;
drop policy if exists "Public can read catalog SEO" on public.vh_catalog_seo_blocks;
create policy "Public can read catalog SEO" on public.vh_catalog_seo_blocks for select to anon,authenticated using (true);
drop policy if exists "Admins manage catalog SEO" on public.vh_catalog_seo_blocks;
create policy "Admins manage catalog SEO" on public.vh_catalog_seo_blocks for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- PostgreSQL table privileges are required in addition to RLS policies.
grant usage on schema public to anon, authenticated;
grant select on public.vh_catalog_seo_blocks to anon;
grant select, insert, update, delete on public.vh_catalog_seo_blocks to authenticated;
