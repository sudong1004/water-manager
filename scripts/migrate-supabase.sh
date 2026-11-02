#!/usr/bin/env bash
# Supabase 프로젝트 이전 (예: 시드니 → 서울).
#
# 옛 프로젝트의 관리자 계정(비밀번호 포함)과 고객·수납·이력·가져오기 기록을 새 프로젝트로 그대로 복사한다.
# 옛 프로젝트는 건드리지 않는다(읽기만 한다). 문제가 생기면 앱 환경변수만 옛 값으로 되돌리면 된다.
#
# 준비
#   1) 새 프로젝트 SQL Editor 에서 supabase/schema.sql 을 먼저 실행해 둔다.
#   2) pg_dump/psql 17 이상: brew install postgresql@17 (또는 libpq)
#   3) 두 프로젝트의 연결 주소(Connect → Session pooler, 포트 5432)를 환경변수로 넣는다.
#      비밀번호가 들어가므로 파일에 적지 말고 터미널에서만 입력한다.
#        export OLD_DB_URL='postgresql://postgres.<옛ref>:<비밀번호>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
#        export NEW_DB_URL='postgresql://postgres.<새ref>:<비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
#
# 실행: bash scripts/migrate-supabase.sh
set -euo pipefail

: "${OLD_DB_URL:?OLD_DB_URL 을 먼저 export 하세요}"
: "${NEW_DB_URL:?NEW_DB_URL 을 먼저 export 하세요}"
if [ "$OLD_DB_URL" = "$NEW_DB_URL" ]; then echo "옛 주소와 새 주소가 같습니다. 중단합니다." >&2; exit 1; fi

TABLES=(auth.users auth.identities public.customers public.payments public.records public.imports)
DUMP="$(mktemp -d)/water-crm-data.sql"
trap 'rm -f "$DUMP"' EXIT

count() { # $1=주소 → 표마다 행 수
  for t in "${TABLES[@]}"; do
    printf '%-18s %s\n' "$t" "$(psql "$1" -At -c "select count(*) from $t")"
  done
}

echo "▶ 새 프로젝트가 비어 있는지 확인"
for t in public.customers public.payments public.records public.imports; do
  n=$(psql "$NEW_DB_URL" -At -c "select count(*) from $t") || { echo "새 프로젝트에 $t 가 없습니다. supabase/schema.sql 을 먼저 실행하세요." >&2; exit 1; }
  if [ "$n" != "0" ]; then echo "새 프로젝트의 $t 에 이미 데이터가 있습니다($n행). 중단합니다." >&2; exit 1; fi
done
n=$(psql "$NEW_DB_URL" -At -c "select count(*) from auth.users")
if [ "$n" != "0" ]; then echo "새 프로젝트에 이미 사용자가 있습니다($n명). 대시보드에서 지우고 다시 실행하세요." >&2; exit 1; fi

echo "▶ 옛 프로젝트에서 내려받는 중 (읽기만 함)"
args=(); for t in "${TABLES[@]}"; do args+=(--table="$t"); done
pg_dump "$OLD_DB_URL" --data-only --no-owner --no-privileges "${args[@]}" -f "$DUMP"

echo "▶ 새 프로젝트에 넣는 중 (하나라도 실패하면 전부 취소)"
# 외래키·트리거를 잠시 꺼서 표 순서와 상관없이 넣는다 (사용자 → 고객 순서 문제 방지)
psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -q \
  -c "set session_replication_role = replica" \
  -f "$DUMP"

echo "▶ 행 수 비교"
paste <(echo "[옛]"; count "$OLD_DB_URL") <(echo "[새]"; count "$NEW_DB_URL")
echo "두 열의 숫자가 모두 같으면 끝입니다."
