-- 공용 PIN 로그인을 없앴다(직원마다 개인 계정). 공용 PIN 해시 표는 더 쓰지 않는다.
drop table public.staff_pin;
