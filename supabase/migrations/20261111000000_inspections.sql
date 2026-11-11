-- RI 검사 완료 표시(B/L 단위). 출고 표는 업로드 때마다 통째로 바뀌므로 완료 여부는 따로 둔다.
-- RI 담당도 같은 직원 PIN으로 들어오므로 직원·관리자 모두 쓰고 지울 수 있다(되돌리기).
create table public.inspections (
  bl text primary key,
  done_at timestamptz not null default now()
);
alter table public.inspections enable row level security;
create policy "직원·관리자 읽기" on public.inspections for select to authenticated using (public.app_role() in ('admin', 'staff'));
create policy "직원·관리자 추가" on public.inspections for insert to authenticated with check (public.app_role() in ('admin', 'staff'));
create policy "직원·관리자 수정" on public.inspections for update to authenticated using (public.app_role() in ('admin', 'staff')) with check (public.app_role() in ('admin', 'staff'));
create policy "직원·관리자 삭제" on public.inspections for delete to authenticated using (public.app_role() in ('admin', 'staff'));
alter publication supabase_realtime add table public.inspections;
