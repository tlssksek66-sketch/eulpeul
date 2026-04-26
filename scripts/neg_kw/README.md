# T010 SA 제외KW 일괄 교체 스크립트

작업 ID: `T010_NEGKW_REPLACE_2026-04-26`
대상: T010 5개 캠페인 / 28개 그룹 / 신규 8개 KW 등록

## 사전 준비

```bash
cd scripts/neg_kw
cp .env.example .env
# .env 편집 — WORKER_TOKEN 입력
node --version   # v18 이상
```

> ⚠️ Worker는 host allowlist 기반 차단 사용. 실행 머신의 egress IP/Host가 Worker allowlist에 등록되어 있어야 합니다.
> Claude Code 샌드박스 환경에서는 차단(`Host not in allowlist`)되며, 운영자 로컬 머신에서만 실행 가능.

## 실행 순서 (STEP 1~7)

### STEP 1. 환경 점검
```bash
node src/step1_health.mjs
```
T010 5개 캠페인 모두 조회 가능한지 확인. 산출물: `output/00_health_*.json`

### STEP 2. 기존 제외KW 전수 dump
```bash
node src/step2_dump.mjs
```
28개 그룹 모두 dump. 산출물: `output/01_dump_before_*.json`

### STEP 3. 보존 KW 충돌 점검 ⚠️
```bash
node src/step3_diff.mjs
```
`config/protect_patterns.json` 패턴과 매칭되는 기존 KW 추출. 산출물: `output/02_diff_analysis_*.json`

**본 단계 종료 후 파트너 검토 필수.** diff 결과를 보고 옵션 1/2/3/4 결정.

| 옵션 | 의미 |
|---|---|
| 1 | 전체 교체 (기존 DELETE + 신규 POST) — ⚠️ 보존 KW도 삭제 |
| **2** | **신규 8개만 추가 (DELETE 없음, POST만) — 권장** |
| 3 | 보존 매칭만 유지 + 그 외 교체 |
| 4 | 작업 보류 (dump만 보존) |

### STEP 4. 등록 계획 확정
```bash
node src/step4_plan.mjs --option=2 --approved-by="파트너명"
```
산출물: `output/03_register_plan_*.json`

본 산출물에 다음 필드 필수 (없으면 step5가 거부):
- `conflict_check.protect_pattern_matched_kws_in_existing`

### STEP 5. 등록 실행 (3중 게이트 ⚠️)
```bash
node src/step5_register.mjs \
  --approve \
  --plan-file=03_register_plan_<TIMESTAMP>.json \
  --confirm-text="REGISTER 224"
```
세 플래그 모두 필수. `--confirm-text`는 step4가 출력하는 정확한 문자열과 일치해야 함.

병렬 3, 200래퍼 검증 (memory #6), 재시도 4회 exp backoff. 산출물: `output/04_register_results_*.json`

### STEP 6. 등록 후 재조회 검증
```bash
node src/step6_verify.mjs
# 또는 즉시 검증 (운영 시 비권장)
node src/step6_verify.mjs --no-wait
# 또는 대기 시간 조정
node src/step6_verify.mjs --wait-sec=300
```
기본 600초(10분) 대기 후 재dump. 산출물: `output/05_dump_after_*.json`, `output/05_diff_after_*.json`

### STEP 7. 인벤토리 자산화
```bash
node src/step7_inventory.mjs
```
민감정보(internal IDs) 제거된 요약을 `inventory/` 하위에 저장:
- `inventory/t010_inventory_master.json` — 누적 갱신
- `inventory/t010_change_log.md` — 시간흐름 추가

산출물: `output/06_inventory_final_*.json`

## 출력 디렉토리 변경

```bash
OUTPUT_DIR=/c/Users/dudvu/SHOKZ_T010_NEGKW_2026-04-26 node src/step1_health.mjs
```
미설정 시 `scripts/neg_kw/output/` 사용.

## 디렉토리 규약

| 디렉토리 | Git 추적 | 내용 |
|---|---|---|
| `output/` | ✗ (.gitignore) | 원본 dump, internal IDs 포함. 운영자 로컬에만 보존 |
| `inventory/` | ✓ | 민감정보 제거된 영구 자산. 변경 이력 추적 |
| `config/` | ✓ | 작업 정의 (대상 그룹, 신규 KW, 보존 패턴) |

## 상태 머신 — `inventory/t010_inventory_master.json`

각 그룹의 `register_status` 필드는 다음 흐름:

```
(미존재)  →  pending      ← STEP 2 dump 완료
pending   →  in_progress  ← STEP 5 등록 시작
in_progress → registered  ← STEP 5 등록 완료 (전체 OK)
in_progress → failed       ← STEP 5 일부 실패
registered → verified      ← STEP 6 재dump로 8KW 모두 확인
registered → failed        ← STEP 6 누락 감지
```

각 STEP은 종료 시 `change_log[]`에 항목 추가하고 `last_updated_at` 갱신.

## 3중 검증 (worker_client.mjs)

`postTarget()` 응답 시 다음 3가지 모두 통과해야 OK:
1. HTTP 200~299
2. body.status가 실패 시그널이 아님 (`error`, `false` 등)
3. 응답 body의 `keyword` / `ownerId` 가 요청값과 일치 (불일치 시 `request_response_mismatch`)

`200 OK ≠ 저장 완료` — 이중 200 래퍼 문제 회피 (memory #6/#34).

### 응답 스키마 추출 (pickField / pickList)

Naver SA Worker가 반환하는 응답 wrapper가 다양해서(평면, `data`, `target`, `result`, `body`, `payload`, `response`, `item(s)`, 단일 원소 배열, 다중 wrapper 중첩) 두 헬퍼로 흡수:

- `pickField(body, ...names)` — 평면 매칭 우선, 미매칭 시 wrapper 키 재귀 (depth ≤ 4). wrapper-키-이름이 names에 있고 값이 객체면 평면 매칭을 건너뛰고 재귀 진행
- `pickList(body, ...listKeys)` — 첫 배열 발견 시 반환. 미발견 시 빈 배열

회귀 테스트(`test/worker_client.test.mjs`)는 34개 케이스로 wrapper/배열/null/순환 참조까지 검증. 운영자 raw 응답 도착 시 새 케이스를 픽스처로 추가하고 매핑 보정.

```bash
npm test     # 또는: node --test test/
```

## 다음 세션 인계

각 STEP 종료 시 콘솔에 `📋 STEP N 종료 — 다음 세션 인계 메시지` 블록 출력. 본 블록을 raw 그대로 다음 Claude 세션에 붙여넣으면 컨텍스트 인계 가능. STEP 3·5·6·7는 특히 다음 행동 지시 명확히 포함.

## 사후 점검 트리거

- T+1일: step6 재실행으로 등록 상태 재확인
- T+3일: 신규 8KW 노출/클릭/비용 0 확인
- T+7일: 그룹 단위 비용 비교
- T+14일: 변형 KW 검색 (예: 띄어쓰기 변형)
- T+28일: 월간 종합 평가
