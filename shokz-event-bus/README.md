# shokz-event-bus

Sovereign OS 시각화 콘솔의 **이벤트 수집 백엔드**.

Claude Code, Apps Script, Make 시나리오, SA 프록시, Slack 등이 발생시키는
모든 활동을 한 곳에 적재해 시간순 스트림 / 시스템별 채널 / 메트릭으로
재구성할 수 있게 한다.

## 아키텍처 위치

[Claude Code hook]    ──┐
[Apps Script 트리거]  ──┤
[Make 시나리오]       ──┼──→ POST /event ──→ [shokz-event-bus]
[SA프록시 Worker]     ──┤                      ├─→ D1 (events 테이블)
[Slack Events]        ──┘                      └─→ /events, /stats 조회 API
↓
(Phase 3) 대시보드 HTML

## 이벤트 스펙

```jsonc
POST /event
{
  "source":  "claude_code",   // 필수. 7개 enum 중 하나
  "kind":    "tool_use",       // 필수. 자유 문자열 (tool_use, trigger_run, put_request, message ...)
  "ref_id":  "abc-123",        // 선택. 외부 추적 ID
  "status":  "success",        // 선택. start / success / error / info / warn (기본 info)
  "summary": "view /home/...", // 선택. ≤500자 한 줄 요약
  "payload": { ... }            // 선택. 자유 JSON, ≤10KB로 절단됨
}
```

### source 7종

| source | 의미 |
|---|---|
| `claude_code` | Claude Code 로컬 hook (PreToolUse / PostToolUse / Stop) |
| `apps_script` | Apps Script 트리거 / WebApp 진입·종료 |
| `make` | Make.com 시나리오 시작·완료 webhook |
| `sa_proxy` | naver-sa-proxy Worker 미들웨어 (PUT/GET 캡처) |
| `slack` | Slack Events API 미러 |
| `manual` | 수동 입력 (테스트, 백필) |
| `claude_session` | Claude(웹/앱 세션) 수동 push — 한계 회피 우회 |

### status 5종

`start` / `success` / `error` / `info` / `warn`

## 조회 API

- `GET /events?limit=&source=&status=&kind=&since=&until=` — 시간순 역정렬, 최대 500건
- `GET /stats?since=ISO` — 시스템×상태 카운트, 시스템별 마지막 활동 시각
- `GET /health` — 헬스체크 (인증 불필요)

## 인증

`/health`를 제외한 모든 엔드포인트는 인증 필수. 두 가지 방식 모두 허용:

1. **헤더 방식 (프로덕션 송신 권장)** — URL·로그 노출 회피

x-event-bus-token: <EVENT_BUS_TOKEN>

2. **쿼리 파라미터 방식 (curl 빠른 테스트용)**

?token=<EVENT_BUS_TOKEN>

토큰은 wrangler secret `EVENT_BUS_TOKEN`. 값: `shokz-event-bus-2026`.
**기존 SA 프록시 토큰(`shokz-progress-media-2026`)과 분리** — 한쪽이 뚫려도 다른 쪽 권한이 노출되지 않도록.

### Phase 2 송신 패턴 (참고)

Apps Script:
```javascript
UrlFetchApp.fetch('https://shokz-event-bus.eupeul.workers.dev/event', {
  method: 'post',
  contentType: 'application/json',
  headers: { 'x-event-bus-token': PropertiesService.getScriptProperties().getProperty('EVENT_BUS_TOKEN') },
  payload: JSON.stringify({ source: 'apps_script', kind: 'trigger_run', /* ... */ }),
  muteHttpExceptions: true
});
```

Claude Code hook (bash, 비동기 fire-and-forget):
```bash
curl -sS --max-time 5 -X POST \
  "https://shokz-event-bus.eupeul.workers.dev/event" \
  -H "x-event-bus-token: $EVENT_BUS_TOKEN" \
  -H "content-type: application/json" \
  -d "$payload" >/dev/null 2>&1 &
```

## 응답 포맷

- 성공: `{"ok": true, ...}`
- 실패: `{"ok": false, "error": "<code>", ...}`

에러 코드 예: `unauthorized`, `invalid_json`, `source_and_kind_required`, `invalid_source`, `invalid_status`, `not_found`, `internal`.

## 데이터 보존

Phase 1은 무기한 보존. 한 달 이상 누적 후 사용 패턴 보고
TTL 또는 아카이브 정책 추가 예정 (Phase 4).

## 운영 원칙 (soul_rules 정합)

- L0-1 자산 우선: 이 이벤트 버스가 모든 활동의 단일 진실 원천(SSoT) 후보.
- L0-3 비가역: DELETE 엔드포인트 의도적으로 미구현. 기록은 append-only.
- soul_core #34: PUT 200 OK ≠ 저장 — `/events` 재조회로 실제 저장 확증.
