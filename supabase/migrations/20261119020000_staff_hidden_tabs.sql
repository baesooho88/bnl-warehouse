-- 직원 계정마다 숨길 탭. 비어 있으면 모두 보인다(나중에 생기는 탭도 기본은 보임). 입출고 탭은 숨기지 않는다.
alter table public.staff_accounts
  add column hidden_tabs text[] not null default '{}' check (hidden_tabs <@ array['RI', '통계', '달력', '검색']);
