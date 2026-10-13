# 정수기 고객관리

Next.js 15 + React 19 + TypeScript + Tailwind 4 (+ 선택: Supabase 로그인/DB)

## 두 가지 실행 모드
| 모드 | 조건 | 저장 위치 | 로그인 |
|---|---|---|---|
| 로컬 모드 | `.env.local` 없음 | `data/*.json` 파일 | 없음 |
| Supabase 모드 | `.env.local`에 Supabase 키 설정 | Supabase DB | 이메일/비밀번호 (관리자별 데이터 분리) |

```
npm install
npm run build && npm start        # http://localhost:3000
```

## Supabase 모드 설정 (관리자 2명이 각자 로그인해서 사용)
1. https://supabase.com 에서 새 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 Run (테이블 + 본인 데이터만 보이는 RLS 정책 생성)
3. **Authentication → Providers → Email**: "Allow new users to sign up"을 **끄기** (아무나 가입하지 못하게)
4. **Authentication → Users → Add user**: 관리자 2명의 이메일/비밀번호를 직접 만들기 ("Auto Confirm User" 체크)
5. **Project Settings → API**에서 `Project URL`과 `Publishable key`(또는 `anon public`)를 복사해 `.env.local` 생성 (`.env.example` 참고)
6. `npm run build && npm start` 후 접속 → 로그인 화면이 나오면 성공
7. 각자 로그인 → **📥 가져오기**에서 본인 엑셀 업로드 (고객 데이터가 본인 계정에만 저장됨)

서버 배포(Vercel)는 같은 두 환경변수를 프로젝트 Environment Variables에 넣으면 됩니다.

## 메뉴
홈(대시보드: 최근 활동 포함) · 고객(검색/지역필터/등록·수정·삭제) · 🗺 지도 · 수납(월별·미수금) · 가져오기(월별 엑셀)
고객 상세: 정보 / 수납 / 이력 탭

## 엑셀 가져오기 규칙
- 관리번호로 기존 고객을 찾음 (신규/변경/동일/오류 미리보기 후 반영)
- 엑셀에서 비어 있는 칸은 기존 값을 지우지 않음
- 필터 최근 교환일은 더 최근 날짜 유지 (앱에서 교환 완료 처리한 기록 보존)
- 수납·이력은 별도 테이블이라 절대 덮어쓰지 않음

## 데이터 구조 (Supabase)
`customers`, `payments`, `records`, `imports` — 모든 행에 `owner_id`가 있고 RLS로 본인 행만 접근 가능.
세부 필드는 `data jsonb` 안에 저장(엑셀 열이 바뀌어도 DB 변경 없이 대응).

## 주의
- 로컬 모드는 로그인이 없으니 인터넷에 공개하지 마세요.
- Supabase 무료 플랜은 일정 기간 사용이 없으면 프로젝트가 일시정지될 수 있으니 가끔 접속하세요.

## 🗺 지도 (카카오맵)
고객 주소를 지도에 핀으로 표시합니다. 핀 색: 🔴 교환 지연 · 🟠 14일 내 · 🟢 정상 · ₩ 미수금. 핀을 누르면 전화 / 길찾기 / 상세.
1. https://developers.kakao.com → 애플리케이션 추가
2. 앱 설정 → 플랫폼 → **Web**에 사이트 주소 등록 (`http://localhost:3000`, 배포 주소)
3. 앱 키의 **JavaScript 키**를 `.env.local`에 추가
   ```
   NEXT_PUBLIC_KAKAO_MAP_KEY=복사한_키
   ```
4. 서버 재시작(`rm -rf .next` 권장) 후 지도 메뉴를 열면, 좌표가 없는 고객의 주소를 자동으로 위치로 변환해 저장합니다(처음 한 번만).
- 주소가 바뀌면 그 고객만 다시 변환합니다. 못 찾은 주소는 화면 아래에 안내됩니다.
- 변환 정확도를 위해 지번 주소는 "주소1 + 번지"까지만 사용합니다 (동·호수 제외).
