# BNL 입출고

보세운송현황(북항·신항, **입고**)과 한화오션 일일출하요청서(**출고**) 엑셀을 휴대폰에서 올려
날짜별 목록 · 검색 · 통계로 보는 안드로이드용 웹앱(PWA)입니다.
서버가 없고, 엑셀 데이터는 **휴대폰 안(IndexedDB)에만** 저장됩니다.

## 매일 쓰는 법

1. PC로 받은 최신 엑셀 3개(북항, 신항, 출하요청서)를 **구글 드라이브** 폴더에 넣거나 카톡 **나와의 채팅**으로 보냅니다.
2. 휴대폰에서 앱을 열고 **올리기** 탭 → **파일 선택** → 3개를 한 번에 고릅니다.
3. 파일은 누적형이라 최신 파일만 올리면 지난 날짜도 함께 채워집니다. 같은 날짜는 새 파일 내용으로 바뀝니다.

## 설치 (안드로이드)

Chrome에서 앱 주소를 열고 메뉴 → **앱 설치**(또는 홈 화면에 추가). 설치 후에는 인터넷 없이도 열립니다.

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm test           # 테스트 (tests/fixtures 의 익명화 엑셀 사용)
npm run build      # 배포용 빌드 (dist/)
npm run fixtures   # source/ 원본에서 익명화 테스트 자료 재생성 + 개인정보 잔존 검사
```

- `source/` 의 원본 엑셀에는 이름·전화번호가 있으므로 **절대 커밋하지 않습니다** (`.gitignore`).
- `main` 브랜치에 push 하면 GitHub Actions 가 테스트 후 GitHub Pages 로 배포합니다
  (저장소 Settings → Pages → Source 를 **GitHub Actions** 로 설정).

## 구조

| 폴더 | 역할 |
|---|---|
| `src/parsers` | 엑셀 → 입고·출고 레코드 (병합 칸 채우기, 날짜·연도 처리) |
| `src/storage` | `Repository` 인터페이스와 IndexedDB 구현 — v2에서 클라우드 구현으로 교체 |
| `src/lib` | 업로드 처리, 날짜·통계·전화번호 도구 |
| `src/screens`, `src/components` | 화면 |

설계: `docs/superpowers/specs/2026-11-05-bnl-warehouse-design.md`
