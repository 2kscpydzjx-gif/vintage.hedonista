-- Vintage Hedonista V259 — subcategories
-- Run once in Supabase Dashboard -> SQL Editor.

begin;

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  unique (category_id, slug)
);

create index if not exists subcategories_category_id_idx
  on public.subcategories(category_id, sort_order, created_at);

alter table public.products
  add column if not exists subcategory_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_subcategory_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_subcategory_id_fkey
      foreign key (subcategory_id)
      references public.subcategories(id)
      on delete set null;
  end if;
end $$;

create index if not exists products_subcategory_id_idx
  on public.products(subcategory_id);

alter table public.subcategories enable row level security;

drop policy if exists subcategories_public_read on public.subcategories;
create policy subcategories_public_read
  on public.subcategories
  for select
  using (true);

drop policy if exists subcategories_admin_insert on public.subcategories;
create policy subcategories_admin_insert
  on public.subcategories
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists subcategories_admin_update on public.subcategories;
create policy subcategories_admin_update
  on public.subcategories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists subcategories_admin_delete on public.subcategories;
create policy subcategories_admin_delete
  on public.subcategories
  for delete
  to authenticated
  using (public.is_admin());

grant select on public.subcategories to anon, authenticated;
grant insert, update, delete on public.subcategories to authenticated;

commit;
