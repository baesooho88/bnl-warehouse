# BNL 입출고

보세운송현황(북항·신항, **입고**)과 한화오션 일일출하요청서(**출고**) 엑셀을 관리자가 올리면
직원 모두가 휴대폰에서 날짜별 목록 · 검색 · 통계로 보는 안드로이드용 웹앱(PWA)입니다.
데이터는 Supabase(서울)에 저장되고, 각 휴대폰에 사본이 있어 인터넷이 끊겨도 마지막 내용을 볼 수 있습니다.

## 직원

1. Chrome에서 앱 주소를 열고 메뉴 → **앱 설치**(또는 홈 화면에 추가).
2. 회사 공용 **PIN 6자리**로 로그인합니다. 여러 번 틀리면 15분간 잠깁니다.
3. 목록 위 **알림 받기**를 켜면 새 입출고가 올라올 때 알림이 옵니다(메뉴 ⋯ 에서 끄기·로그아웃).
4. 관리자가 올리면 앱이 열려 있을 때 바로, 아니면 다음에 열 때 갱신됩니다. 위쪽 상태 줄에 마지막 동기화 시각이 보입니다.

## 관리자 (업로드는 관리자만)

1. **관리자 로그인 ›** 으로 이메일·비밀번호 로그인(PC 브라우저도 됩니다).
2. **올리기** 탭 → 최신 엑셀 3개(북항, 신항, 출하요청서)를 한 번에 고릅니다. 인터넷이 필요합니다.
   파일은 누적형이라 최신 파일만 올리면 지난 날짜도 채워지고, 같은 날짜는 새 내용으로 통째로 바뀝니다.
   올리면 직원들에게 알림이 갑니다.
3. **직원 PIN 변경**: 같은 탭 아래. 바꾸면 직원 폰은 1시간 안에 로그아웃됩니다(새 PIN 공유).

운영(비밀번호·키 교체, 재배포, 점검): `docs/operations.md`

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm test           # 테스트 (tests/fixtures 의 익명화 엑셀 사용)
npm run build      # 배포용 빌드 (dist/)
npm run fixtures   # source/ 원본에서 익명화 테스트 자료 재생성 + 개인정보 잔존 검사
```

- `.env.example` 을 `.env.local` 로 복사해 공개 값(Supabase URL·publishable 키·VAPID 공개 키)을 채웁니다.
  배포 빌드는 같은 값을 GitHub 저장소 Settings → Secrets and variables → Actions → **Variables** 에서 읽습니다.
- 비밀 값(service role 키, 비밀번호, PIN, VAPID 비밀 키)은 저장소에 두지 않습니다.
- `source/` 의 원본 엑셀에는 이름·전화번호가 있으므로 **절대 커밋하지 않습니다** (`.gitignore`).
- `main` 브랜치에 push 하면 GitHub Actions 가 테스트 후 GitHub Pages 로 배포합니다
  (저장소 Settings → Pages → Source 를 **GitHub Actions** 로 설정).

## 구조

| 폴더 | 역할 |
|---|---|
| `src/parsers` | 엑셀 → 입고·출고 레코드 (병합 칸 채우기, 날짜·연도 처리) |
| `src/storage` | `Repository` 인터페이스, 휴대폰 사본(IndexedDB), 클라우드 쓰기 |
| `src/sync`, `src/auth`, `src/push` | 동기화, PIN·관리자 로그인, 알림 구독 |
| `supabase/` | DB 구조(migrations)와 서버 함수(PIN 로그인, PIN 변경, 알림) |
| `src/lib` | 업로드 처리, 날짜·통계·전화번호 도구 |
| `src/screens`, `src/components` | 화면 |

설계: `docs/superpowers/specs/2026-11-05-bnl-warehouse-design.md`(v1), `docs/superpowers/specs/2026-11-05-bnl-warehouse-v2-cloud-design.md`(v2)
