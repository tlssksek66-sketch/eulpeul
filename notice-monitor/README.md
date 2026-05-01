# notice-monitor

네이버 광고 공지 모니터링 → 분류 → 적재·알림 파이프라인 (Cloudflare Worker).

## 아키텍처

```
Cron (09:00·18:00 KST)
        │
        ▼
Perplexity Sonar Pro  ──── 공지 30건 수집
        │
        ▼
KV diff (seen-ids)    ──── 신규만 추출
        │
        ▼
Claude Sonnet 4       ──── shokzImpact / salesValue / categories / summary
        │
        ▼
영업가치 높음만 → Perplexity 본문 전문 수집
        │
        ├─→ Google Sheets   (전체 신규, 운영 매핑)
        ├─→ Notion DB        (영업가치 높음만, 영업 자산)
        └─→ Slack DM         (직접영향·간접영향·영업가치 높음 분리 표시)
```

## 셋업·배포

```bash
cd notice-monitor

# 의존성
npm install

# wrangler 로그인
npx wrangler login

# KV namespace 생성 (출력된 id를 wrangler.toml 의 REPLACE_WITH_KV_NAMESPACE_ID 에 복사)
npx wrangler kv namespace create "NOTICE_KV"

# 시크릿 9종 일괄 등록 (.env.secrets 작성 후)
bash scripts/setup-secrets.sh
# 또는 개별 등록:
#   npx wrangler secret put PERPLEXITY_API_KEY
#   npx wrangler secret put ANTHROPIC_API_KEY
#   npx wrangler secret put GOOGLE_SHEETS_ID
#   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
#   npx wrangler secret put NOTION_API_KEY
#   npx wrangler secret put NOTION_DATABASE_ID
#   npx wrangler secret put SLACK_BOT_TOKEN              # SHOKZ Apps Script C 객체 재사용 가능
#   npx wrangler secret put SLACK_CHANNEL_ID             # D0866GYA3M1
#   npx wrangler secret put ADMIN_AUTH_TOKEN             # /admin/* Bearer 토큰

# 배포
npx wrangler deploy

# 헬스체크 + KV 상태
TOKEN='c406...6ed9'
WORKER='https://notice-monitor.eupeul.workers.dev'
curl -H "Authorization: Bearer $TOKEN" "$WORKER/admin/status"

# 실시간 로그
npx wrangler tail
```

## 관리 엔드포인트 (v2)

전부 `Authorization: Bearer $ADMIN_AUTH_TOKEN` 필요.

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/admin/status` | KV 상태 + secrets 점검 + cron 표시 |
| GET | `/admin/run` | 풀 파이프라인 수동 실행 (수집·분류·적재·알림) |
| GET | `/admin/run?dry=1` | 분류까지만, 적재·푸시·KV 갱신 모두 스킵 |
| GET | `/admin/reset` | `seen-ids` KV 비움 (다음 실행에서 전체 재처리) |
| GET | `/admin/unmark?id=NOTICE_ID` | 특정 noticeId 만 제외 (1건 재처리) |
| POST | `/admin/classify-test` | NoticeRaw JSON body → 분류 결과만 반환 (적재 X) |

예시:
```bash
TOKEN='c406...6ed9'
WORKER='https://notice-monitor.eupeul.workers.dev'

# 헬스체크
curl -H "Authorization: Bearer $TOKEN" "$WORKER/admin/status"

# 분류 시뮬레이션 (적재 X, 비용만 분류 1회)
curl -H "Authorization: Bearer $TOKEN" "$WORKER/admin/run?dry=1"

# 첫 수집 (실제 적재 + Slack 알림)
curl -H "Authorization: Bearer $TOKEN" "$WORKER/admin/run"

# 특정 공지 1건만 분류 테스트 (POST)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-04-30","title":"검색광고 카테고리 매핑 변경","noticeId":"31108","url":"https://ads.naver.com/notice/31108","category":"검색광고"}' \
  "$WORKER/admin/classify-test"
```

## Cron

- `0 0 * * *` UTC = 09:00 KST
- `0 9 * * *` UTC = 18:00 KST

## 분류 출력 (Claude Sonnet 4)

| 필드 | 값 | 의미 |
|---|---|---|
| `shokzImpact` | 직접 / 간접 / 무관 | SHOKZ 캠페인(SA SP00·SP01~05·SPB / GFA / 디지털가전 무선이어폰)에 영향도 |
| `salesValue` | 높음 / 중간 / 낮음 | 광고주 향 영업 자료 인용 가능성 |
| `salesCategories` | string[] | 디지털가전·패션·식음료·가구인테리어·뷰티·일반 중 매칭 |
| `summary` | string ≤ 50자 | 핵심 변화 한 줄 |

## 검증·운영

- **수동 트리거**: `GET /trigger?key=shokz-progress-media-2026`
- **헬스체크**: `GET /` → "OK"
- **운영 대시보드**: Google Sheets `NaverNoticeMonitor` 시트 (date·title·noticeId·url·category·shokzImpact·salesValue·salesCategories·summary·firstSeen·classifiedAt)
- **영업 자산**: Notion DB (영업가치 높음만, 본문 전문 첨부)

## 비용 (월 예상)

| 항목 | 단가 | 일 사용 | 월 |
|---|---|---|---|
| Perplexity Sonar Pro 수집 | $5/M tok | 2회 × ~5K tok | 무료 크레딧 ($5) |
| Perplexity 본문 전문 | $5/M tok | ~5건 × ~3K tok | 무료 크레딧 |
| Claude Sonnet 4 분류 | $3/$15 per M | 신규 ~5건 × ~1K tok | < $1 |
| Cloudflare Worker | 100K req/day 무료 | < 50 req/일 | $0 |
| Google Sheets / Notion / Slack | 0 | — | $0 |

총 < **$1/월** (Perplexity 무료 크레딧 한도 내).
