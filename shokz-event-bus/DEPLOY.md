# shokz-event-bus 배포 가이드 (Phase 1)

> **대상 환경**: Windows + Git Bash, 작업 경로 `/c/Users/dudvu/`
> **권장 실행자**: 파트너 직접 (Cloudflare 자격증명·네트워크 필요)
> **선결 조건**: Cloudflare 계정 로그인 완료된 wrangler

---

## 1. 작업 폴더 준비

```bash
cd /c/Users/dudvu
mkdir -p shokz-event-bus && cd shokz-event-bus
# repo의 shokz-event-bus/ 에서 5개 파일 복사:
#   worker.js / wrangler.toml / schema.sql / .gitignore / README.md
```

## 2. wrangler 로그인 확인

```bash
npx wrangler whoami
# 로그인 안 되어 있으면:  npx wrangler login
```

## 3. D1 데이터베이스 생성 + UUID 패치

```bash
npx wrangler d1 create shokz_events
```

출력 예시: ✅ Successfully created DB 'shokz_events'
[[d1_databases]]
binding = "DB"
database_name = "shokz_events"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

→ 출력된 `database_id` UUID를 **`wrangler.toml` 의 `REPLACE_WITH_D1_UUID` 자리에 손편집 붙여넣기**.
이 한 줄 패치가 끝나야 4단계로 진행 가능.

## 4. 스키마 적용

```bash
# 원격(프로덕션) D1에 적용
npx wrangler d1 execute shokz_events --remote --file=schema.sql

# (선택) 로컬 개발용에도 적용
npx wrangler d1 execute shokz_events --local --file=schema.sql
```

## 5. 인증 토큰 등록 (Secret)

```bash
echo "shokz-event-bus-2026" | npx wrangler secret put EVENT_BUS_TOKEN
```

> 기존 SA 프록시 토큰(`shokz-progress-media-2026`)과 **반드시 분리**합니다.
> 이벤트 버스가 뚫려도 SA 프록시 권한이 노출되지 않도록.

## 6. 배포

```bash
npx wrangler deploy
```

성공 시 URL 출력: https://shokz-event-bus.eupeul.workers.dev

## 7. 검증 (4단계 — soul_core #34 PUT 검증 원칙 준용)

인증은 **헤더 방식 권장** (URL·셸 히스토리 노출 회피). 쿼리 방식도 동작.

### 7-1. 헬스체크 (인증 불필요)
```bash
curl --max-time 30 "https://shokz-event-bus.eupeul.workers.dev/health"
# 기대: {"ok":true,"ts":"..."}
```

### 7-2. 첫 이벤트 송신 (헤더 방식)
```bash
curl --max-time 30 -X POST \
  "https://shokz-event-bus.eupeul.workers.dev/event" \
  -H "x-event-bus-token: shokz-event-bus-2026" \
  -H "content-type: application/json" \
  -d '{
    "source":"manual",
    "kind":"deploy_test",
    "status":"info",
    "summary":"Phase 1 deploy ok",
    "payload":{"by":"partner","note":"first event"}
  }'
# 기대: {"ok":true,"id":1,"ts":"...","ts_kst":"..."}
```

(쿼리 방식 동등):
```bash
curl --max-time 30 -X POST \
  "https://shokz-event-bus.eupeul.workers.dev/event?token=shokz-event-bus-2026" \
  -H "content-type: application/json" \
  -d '{"source":"manual","kind":"deploy_test","status":"info","summary":"Phase 1 deploy ok"}'
```

### 7-3. 조회로 실제 저장 확증
```bash
curl --max-time 30 \
  -H "x-event-bus-token: shokz-event-bus-2026" \
  "https://shokz-event-bus.eupeul.workers.dev/events?limit=5"
# 기대: events 배열에 방금 보낸 deploy_test 이벤트 포함
```

### 7-4. 통계
```bash
curl --max-time 30 \
  -H "x-event-bus-token: shokz-event-bus-2026" \
  "https://shokz-event-bus.eupeul.workers.dev/stats"
# 기대: by_source_status 에 manual/info 1건
```

## 8. 보고

세션에 다음 7개를 그대로 붙여넣기 (raw):
- `wrangler whoami` 출력
- `wrangler d1 create` 출력 (database_id 포함 행)
- `wrangler d1 execute --remote` 출력
- `wrangler deploy` 출력
- 7-1~7-4 curl 응답 4개

→ 정리·요약 금지, raw 그대로. 검증·진단은 세션이 함.

---

## 트러블슈팅

| 증상 | 원인 | 조치 |
|---|---|---|
| `database_id` 자리 그대로면 deploy 실패 | 3단계 UUID 패치 누락 | wrangler.toml의 UUID 교체 후 재배포 |
| `{"ok":false,"error":"unauthorized"}` | 토큰 불일치 또는 헤더명 오타 | 5단계 secret 재등록 + 헤더명 `x-event-bus-token` 정확히 |
| `{"ok":false,"error":"internal"}` | 스키마 미적용 가능성 | 4단계 `--remote` 재실행 |
| KST 시각이 어긋남 | 의도된 동작 | `ts_kst`는 표시용, 정렬·필터는 항상 `ts`(UTC) |

---

## 다음 Phase 미리보기

- **Phase 2**: Claude Code hook (`~/.claude/settings.json`) + Apps Script `_logEvent_()` 헬퍼.
  - 두 채널이 가장 정보량 큼. 여기 붙으면 시스템 절반 가시화.
  - 인증은 둘 다 `x-event-bus-token` 헤더 통일.
- **Phase 3**: 단일 HTML 대시보드 (SSE 스트림).
- **Phase 4**: Make webhook + Slack 미러 + 메트릭 차트.
