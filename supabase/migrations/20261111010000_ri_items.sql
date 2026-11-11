-- RI 준비자재 작업표(관리자가 올림). 하루치(파일 이름의 날짜)를 통째로 바꾼다. 검사 완료는 inspections(B/L)를 같이 쓴다.
create table public.ri_items (
  base_date date not null,
  idx int not null,
  bl text not null,
  po text, hull text, qty_text text, item text, wms text,
  pres_work text, pres_report text, box text, ri_location text, note text,
  primary key (base_date, idx)
);
alter table public.ri_items enable row level security;
create policy "직원·관리자 읽기" on public.ri_items for select to authenticated using (public.app_role() in ('admin', 'staff'));
-- 쓰기 정책은 두지 않는다: replace_ri 로만 쓴다
alter publication supabase_realtime add table public.ri_items;

create or replace function public.replace_ri(base_date date, rows jsonb)
returns int
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare n int;
begin
  if public.app_role() <> 'admin' then
    raise exception '관리자만 업로드할 수 있어요' using errcode = '42501';
  end if;
  delete from public.ri_items r where r.base_date = base_date;
  insert into public.ri_items select * from jsonb_populate_recordset(null::public.ri_items, rows);
  get diagnostics n = row_count;
  return n;
end
$$;
revoke execute on function public.replace_ri(date, jsonb) from public, anon;
grant execute on function public.replace_ri(date, jsonb) to authenticated;
