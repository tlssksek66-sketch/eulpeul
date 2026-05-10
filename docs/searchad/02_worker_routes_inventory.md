# SHOKZ — Worker routes inventory (D 트랙 Step 2)

생성일: 2026-05-10
조사 환경: Linux VM (/home/user/eulpeul), `claude/naver-searchad-api-integration-L82Lk`
원래 저장 요청 경로: `/c/Users/dudvu/SHOKZ_worker_routes_inventory.md`

---

## 1. 자동 탐색 결과

### 1.1 Windows host 마운트 (사용자 PC 직결 시도)

| 후보 경로 | 결과 |
|---|---|
| `/c/Users/dudvu` | absent |
| `/mnt/c/Users/dudvu` | absent |
| `/host/c/Users/dudvu` | absent |
| `/windows/Users/dudvu` | absent |

```
$ mount | grep -iE "ntfs|cifs|/c|/mnt|/host|/media|/Volumes"
# (관련 마운트 0건)
$ ls /mnt /media /Volumes /host /windows
# /media: 비어있음, /mnt: 비어있음, 나머지 부재
```

→ **이 VM은 사용자 호스트와 격리되어 있어, `/c/Users/dudvu/shokz-apps-script` 직접 접근 불가.**

### 1.2 레포 내 Worker 코드 후보

```
$ find /home/user/eulpeul -name "wrangler.toml"
/home/user/eulpeul/mcp/wrangler.toml

$ find /home/user/eulpeul -name "worker.*"
/home/user/eulpeul/mcp/worker.mjs
```

`mcp/wrangler.toml` 내용:
```toml
name = "shokz-kb-mcp"
main = "worker.mjs"
compatibility_date = "2026-01-15"
workers_dev = true
[observability]
enabled = true
```

`mcp/worker.mjs` 내용 요약:
- **다른 워커**입니다 — SHOKZ KB(인사이트/로드맵/임베딩) MCP HTTP 서버
- 라우트: `POST /mcp` (JSON-RPC), `GET /healthz`, `GET /`
- 외부 호출: `tlssksek66-sketch.github.io/eulpeul/assets/data/*.json` (KB fetch)
- 인증: `Authorization: Bearer ${MCP_BEARER_TOKEN}` (단순)
- **`api.searchad.naver.com` 호출 / HMAC sign / X-Signature 헤더 0건**

### 1.3 마커 토큰 grep (사용자 지정)

```
$ grep -ril -E "shokz-progress-media|naver-sa-proxy|searchad\.naver|nccCriterion|api\.searchad" /home/user/eulpeul
/home/user/eulpeul/docs/searchad/01_official_api_grep.md   # ← 자기 산출물
```

→ **자기 산출물 외 0건.** SA 프록시 워커는 이 레포에 없음.

### 1.4 git remote

```
origin → tlssksek66-sketch/eulpeul   (fetch + push)
```

→ SA 워커 관련 별도 remote 없음.

---

## 2. 결론

- ❌ Worker 코드는 이 VM 또는 이 레포 어디에도 존재하지 않음
- ✅ 이 레포의 `mcp/worker.mjs`는 **별개 워커**(KB MCP), SA 통합과 무관
- 다음 진입 조건: 파트너가 SA 워커 코드를 공급해야 함

---

## 3. 파트너 입력 요청 (택일)

| 옵션 | 형식 | 비고 |
|---|---|---|
| A | `https://github.com/<owner>/shokz-apps-script` 등 clone 가능한 URL | private이면 read-only PAT 동봉, 사용 후 폐기 |
| B | `worker.js` (또는 `.gs`) 본문 인라인 paste | 가장 빠름. 비밀(secret/api key)은 redact |
| C | `wrangler.toml` + `worker.*` + sign 함수 포함된 모듈 묶음 paste | 라우트가 여러 파일에 분산되어 있을 때 |

받는 즉시 다음 작업 자동 수행:
1. 라우트 인덱스 (path × method × handler) 전체 dump
2. `/criterion` / `criterion-related` 라우트 존재 여부
3. HMAC sign 함수 위치 + signing string 포맷 + base64/hex 여부
4. 1.1절(공식 API grep)의 정설(`${ms}.${METHOD}.${URI_PATH}`, base64) 대비 일치/불일치 표
