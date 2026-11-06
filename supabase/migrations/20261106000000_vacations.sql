-- 휴가 달력 (스펙: docs/superpowers/specs/2026-11-06-bnl-warehouse-vacation-calendar-design.md 3장)
create table public.vacations (
  id bigint generated always as identity primary key,
  date date not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 20),
  type text not null check (type in ('연차', '오전반차', '오후반차', '기타')),
  created_at timestamptz not null default now(),
  unique (date, name)
);
create index vacations_date on public.vacations (date);

alter table public.vacations enable row level security;
create policy "직원·관리자 읽기" on public.vacations for select to authenticated using (public.app_role() in ('admin', 'staff'));
create policy "관리자 추가" on public.vacations for insert to authenticated with check (public.app_role() = 'admin');
create policy "관리자 삭제" on public.vacations for delete to authenticated using (public.app_role() = 'admin');

alter publication supabase_realtime add table public.vacations;
