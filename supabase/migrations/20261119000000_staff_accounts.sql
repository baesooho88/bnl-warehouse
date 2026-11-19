-- 직원 개인 계정과 권한. 공용 PIN 계정은 그대로 두고, 권한이 필요한 직원만 개인 계정을 받는다.
-- 개인 계정도 auth 사용자(app_metadata.role = 'staff')이고, 권한은 이 표에서 읽는다(바꾸면 바로 적용).
create table public.staff_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  login_id text not null unique check (login_id ~ '^[a-z0-9]{2,20}$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 20),
  perms text[] not null default '{}' check (perms <@ array['container', 'calendar']),
  created_at timestamptz not null default now()
);
-- PIN 해시는 따로: 정책 없음(service role만)
create table public.staff_account_pins (
  user_id uuid primary key references public.staff_accounts on delete cascade,
  pin_hash text not null
);
alter table public.staff_accounts enable row level security;
alter table public.staff_account_pins enable row level security;
create policy "본인·관리자 읽기" on public.staff_accounts for select to authenticated using (user_id = auth.uid() or public.app_role() = 'admin');
create policy "관리자 권한 수정" on public.staff_accounts for update to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
-- 추가·삭제는 서버 함수(staff-accounts)가 auth 사용자와 함께 한다

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_role() = 'admin'
    or exists (select 1 from public.staff_accounts where user_id = auth.uid() and p = any(perms))
$$;
revoke execute on function public.has_perm(text) from public, anon;
grant execute on function public.has_perm(text) to authenticated, service_role;

-- 컨테이너 상태: 관리자 또는 'container' 권한
drop policy "관리자 추가" on public.container_status;
drop policy "관리자 수정" on public.container_status;
drop policy "관리자 삭제" on public.container_status;
create policy "권한자 추가" on public.container_status for insert to authenticated with check (public.has_perm('container'));
create policy "권한자 수정" on public.container_status for update to authenticated using (public.has_perm('container')) with check (public.has_perm('container'));
create policy "권한자 삭제" on public.container_status for delete to authenticated using (public.has_perm('container'));

-- 휴가 달력: 관리자 또는 'calendar' 권한
drop policy "관리자 추가" on public.vacations;
drop policy "관리자 수정" on public.vacations;
drop policy "관리자 삭제" on public.vacations;
create policy "권한자 추가" on public.vacations for insert to authenticated with check (public.has_perm('calendar'));
create policy "권한자 수정" on public.vacations for update to authenticated using (public.has_perm('calendar')) with check (public.has_perm('calendar'));
create policy "권한자 삭제" on public.vacations for delete to authenticated using (public.has_perm('calendar'));
