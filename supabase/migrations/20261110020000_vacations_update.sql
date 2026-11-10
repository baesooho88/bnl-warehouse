-- 달력 항목 수정: 관리자만(삭제·추가와 같은 규칙)
create policy "관리자 수정" on public.vacations for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
