-- 컨테이너 상태(관리자가 앱에서 바꿈). 입고 표는 업로드 때마다 통째로 바뀌므로 상태는 따로 둔다.
-- 행이 없으면 '입고예정'. 같은 컨테이너 번호가 나중에 다른 B/L로 다시 와도 섞이지 않게 (B/L, 번호)로 구분.
create table public.container_status (
  bl text not null,
  container_no text not null,
  status text not null check (status in ('입고예정', '입고됨', '반입됨')),
  updated_at timestamptz not null default now(),
  primary key (bl, container_no)
);
alter table public.container_status enable row level security;
create policy "직원·관리자 읽기" on public.container_status for select to authenticated using (public.app_role() in ('admin', 'staff'));
create policy "관리자 추가" on public.container_status for insert to authenticated with check (public.app_role() = 'admin');
create policy "관리자 수정" on public.container_status for update to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy "관리자 삭제" on public.container_status for delete to authenticated using (public.app_role() = 'admin');
alter publication supabase_realtime add table public.container_status;
