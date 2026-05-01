#!/usr/bin/env bash
# setup-secrets.sh
#  .env.secrets 의 KEY=VALUE 항목을 wrangler secret put 으로 일괄 등록.
#
# 사용:
#   cd /c/Users/dudvu/notice-monitor
#   bash scripts/setup-secrets.sh
#
# 사전 조건:
#   - .env.secrets 파일이 cwd 에 존재 (KEY=VALUE 라인, 따옴표 없이)
#   - npx wrangler login 완료
#   - wrangler.toml 의 NOTICE_KV id 가 실제 KV namespace id 로 교체됨
#
# 멀티라인 값(GOOGLE_SERVICE_ACCOUNT_JSON 등) 은 .env.secrets 에 한 줄로 압축해서 넣을 것.
# (개행 문자가 들어간 JSON 은 별도로 `npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON < service-account.json` 사용 권장.)

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.secrets}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ $ENV_FILE not found in $(pwd)" >&2
  echo "  먼저 .env.secrets 를 작성하세요." >&2
  exit 1
fi

EXPECTED=(
  PERPLEXITY_API_KEY
  ANTHROPIC_API_KEY
  GOOGLE_SHEETS_ID
  GOOGLE_SERVICE_ACCOUNT_JSON
  NOTION_API_KEY
  NOTION_DATABASE_ID
  SLACK_BOT_TOKEN
  SLACK_CHANNEL_ID
  ADMIN_AUTH_TOKEN
)

echo "=== wrangler secret 일괄 등록 시작 ==="
echo "    파일: $ENV_FILE"
echo "    대상: ${#EXPECTED[@]} 항목"
echo

ok=0
miss=0
for key in "${EXPECTED[@]}"; do
  # KEY=VALUE 패턴에서 첫 = 기준으로 split, 우측 전체를 값으로
  line=$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)
  if [[ -z "$line" ]]; then
    echo "  [-] $key — .env.secrets 에 없음, 스킵"
    miss=$((miss + 1))
    continue
  fi
  val="${line#${key}=}"
  # 양쪽 큰따옴표 제거
  val="${val%\"}"
  val="${val#\"}"
  # 양쪽 작은따옴표 제거
  val="${val%\'}"
  val="${val#\'}"

  if [[ -z "$val" ]]; then
    echo "  [-] $key — 값이 비어있음, 스킵"
    miss=$((miss + 1))
    continue
  fi

  echo "  [→] $key putting..."
  printf '%s' "$val" | npx wrangler secret put "$key"
  ok=$((ok + 1))
done

echo
echo "=== 완료: 등록 $ok / 미등록 $miss ==="
echo "확인: npx wrangler secret list"
