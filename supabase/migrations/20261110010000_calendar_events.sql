-- 달력 일정(방문·업무, 하루짜리): 휴가 표에 종류 '일정'과 시간 칸을 더한다. 일정 내용은 name 칸에 30자까지.
alter table public.vacations drop constraint vacations_name_check;
alter table public.vacations drop constraint vacations_type_check;
alter table public.vacations
  add constraint vacations_name_check check (name = btrim(name) and char_length(name) between 1 and 30),
  add constraint vacations_type_check check (type in ('연차', '오전반차', '오후반차', '기타', '일정')),
  add column time text check (time is null or time ~ '^[0-2][0-9]:[0-5][0-9]$');
