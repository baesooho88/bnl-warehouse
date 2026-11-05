-- BNL 입출고 v2: 클라우드 저장 (스펙 v2 3장)

-- 1. 표 -----------------------------------------------------------------
create table public.inbound (
  id text primary key,
  port text not null check (port in ('북항', '신항')),
  base_date date not null,
  arrival_date date,
  vessel text,
  bl text not null,
  item text,
  qty numeric,
  weight_kg numeric,
  cbm numeric,
  hull text,
  po text,
  terminal text,
  containers jsonb not null default '[]',
  destination text,
  note text,
  raw jsonb not null default '{}'
);
create index inbound_port_base_date on public.inbound (port, base_date);

create table public.outbound (
  id text primary key,
  base_date date not null,
  seq numeric,
  center text,
  bnl_in_date date,
  bl text,
  hull text,
  po text,
  item text,
  qty_text text,
  qty_requested numeric,
  qty_total numeric,
  weight_kg numeric,
  cbm numeric,
  box_no text,
  destination text,
  gate_time text,
  memo text,
  inspected_date date,
  requester text,
  arrive_date date,
  location text,
  same_day boolean not null,
  raw jsonb not null default '{}'
);
create index outbound_base_date on public.outbound (base_date);

create table public.upload_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('입고-북항', '입고-신항', '출고')),
  base_dates date[] not null,
  file_name text,
  row_count int not null
);

create table public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table public.staff_pin (
  id int primary key check (id = 1),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.login_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
create index login_failures_at on public.login_failures (at);

-- 2. 권한 (RLS) ----------------------------------------------------------
alter table public.inbound enable row level security;
alter table public.outbound enable row level security;
alter table public.upload_log enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.staff_pin enable row level security;        -- 정책 없음: service role만
alter table public.login_failures enable row level security;   -- 정책 없음: service role만

-- 역할은 사용자가 바꿀 수 없는 app_metadata.role 에서만 읽는다
create or replace function public.app_role() returns text
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create policy "직원·관리자 읽기" on public.inbound for select to authenticated using (public.app_role() in ('admin', 'staff'));
create policy "직원·관리자 읽기" on public.outbound for select to authenticated using (public.app_role() in ('admin', 'staff'));
create policy "직원·관리자 읽기" on public.upload_log for select to authenticated using (public.app_role() in ('admin', 'staff'));
-- inbound/outbound/upload_log 쓰기 정책은 두지 않는다: replace_days 로만 쓴다

create policy "본인 구독 읽기" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "본인 구독 등록" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "본인 구독 갱신" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "본인 구독 삭제" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- 3. 하루치 통째 교체 (관리자 전용, 한 트랜잭션) ---------------------------
create or replace function public.replace_days(kind text, base_dates date[], rows jsonb, file_name text)
returns bigint
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  new_id bigint;
  n int;
begin
  if public.app_role() <> 'admin' then
    raise exception '관리자만 업로드할 수 있어요' using errcode = '42501';
  end if;

  if kind = '출고' then
    delete from public.outbound where base_date = any (base_dates);
    insert into public.outbound select * from jsonb_populate_recordset(null::public.outbound, rows);
  elsif kind in ('입고-북항', '입고-신항') then
    delete from public.inbound
      where port = (case kind when '입고-북항' then '북항' else '신항' end)
        and base_date = any (base_dates);
    insert into public.inbound select * from jsonb_populate_recordset(null::public.inbound, rows);
  else
    raise exception '알 수 없는 종류: %', kind;
  end if;
  get diagnostics n = row_count;

  insert into public.upload_log (kind, base_dates, file_name, row_count)
    values (kind, base_dates, file_name, n)
    returning id into new_id;
  return new_id;
end
$$;
revoke execute on function public.replace_days(text, date[], jsonb, text) from public, anon;
grant execute on function public.replace_days(text, date[], jsonb, text) to authenticated;

-- 4. 직원 세션 무효화 (PIN 변경 시, 서버 함수에서만) ----------------------
create or replace function public.revoke_staff_sessions(staff_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.refresh_tokens where user_id = staff_id::text;
  delete from auth.sessions where user_id = staff_id;
end
$$;
revoke execute on function public.revoke_staff_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_staff_sessions(uuid) to service_role;

-- 5. 실시간: 업로드 기록이 생기면 앱에 알린다 ------------------------------
alter publication supabase_realtime add table public.upload_log;
