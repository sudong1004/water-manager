-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 각 관리자는 자기 계정(owner_id)의 행만 읽고/쓰고/지울 수 있습니다 (RLS).

create table if not exists public.customers (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,                 -- 관리번호
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.payments (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.records (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.imports (
  id         uuid primary key,
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_owner_customer on public.payments (owner_id, customer_id);
create index if not exists records_owner_customer  on public.records  (owner_id, customer_id);

-- 행 단위 보안: 본인 데이터만
do $$
declare t text;
begin
  foreach t in array array['customers','payments','records','imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
