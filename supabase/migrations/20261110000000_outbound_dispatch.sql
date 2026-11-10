-- 배차 시트에서 붙인 차량 정보(출고 한 건당). replace_days는 jsonb_populate_recordset으로 새 열을 그대로 받는다.
alter table public.outbound add column dispatch jsonb;
