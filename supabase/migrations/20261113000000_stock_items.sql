-- 재고 현황(관리자가 올림). 가장 최근 파일 하나만 둔다: 올릴 때마다 표 전체를 바꾼다. 검색 탭이 이 표만 검색한다.
create table public.stock_items (
  idx int primary key,
  base_date date not null,
  bl text not null,
  item text, box text, qty numeric, weight_kg numeric, cbm numeric, location text,
  in_date date, in_no text, po text, project text, customs_no text, cargo_no text, note text
);
alter table public.stock_items enable row level security;
create policy "직원·관리자 읽기" on public.stock_items for select to authenticated using (public.app_role() in ('admin', 'staff'));
-- 쓰기 정책은 두지 않는다: replace_stock 으로만 쓴다

create or replace function public.replace_stock(rows jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.app_role() <> 'admin' then
    raise exception '관리자만 업로드할 수 있어요' using errcode = '42501';
  end if;
  delete from public.stock_items where true;
  insert into public.stock_items select * from jsonb_populate_recordset(null::public.stock_items, rows);
  get diagnostics n = row_count;
  return n;
end
$$;
revoke execute on function public.replace_stock(jsonb) from public, anon;
grant execute on function public.replace_stock(jsonb) to authenticated;
