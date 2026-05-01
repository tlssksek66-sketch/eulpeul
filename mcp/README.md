# SHOKZ KB · MCP

SHOKZ 광고 인사이트 KB · 운영 로드맵에 대한 **Model Context Protocol** 서버. 두 surface 가 동일한 코어 로직을 공유:

| Surface | 용도 | 호스팅 |
|---|---|---|
| **stdio** (`stdio.mjs`) | Claude Desktop · Claude Code · Cursor 등 로컬 클라이언트 | 분석가 PC, Node.js |
| **HTTP** (`worker.mjs`) | 모바일 · 웹 · Slack/Teams · 임의 MCP 클라이언트 | Cloudflare Workers (무료 티어) |

## 노출 도구

| Tool | 용도 |
|---|---|
| `search_insights(query, k)` | 자유 텍스트 시맨틱 검색 (Voyage 라이브 임베딩) |
| `match_advertiser({industry, audience, query, k})` | 광고주 매칭 — 카드 + SA/GFA 플레이 |
| `get_card(url)` | 카드 전체 상세 |
| `get_roadmap()` | 시장 요약 + SA/GFA 플레이북 전체 |
| `list_meta(kind)` | 산업 / 브랜드 / 플랫폼 / 오디언스 Top + 빈도 |
| `get_neighbors(url, k)` | 사전 계산된 유사 카드 |
| `list_all_cards()` | 전체 카드 overview |

## 1. 로컬 stdio 사용법 (Claude Desktop / Code)

### 의존성 설치
```bash
cd /path/to/eulpeul
npm install
```

### Claude Desktop 등록
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 또는 `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "shokz-kb": {
      "command": "node",
      "args": ["/absolute/path/to/eulpeul/mcp/stdio.mjs"],
      "env": {
        "VOYAGE_API_KEY": "pa-..."
      }
    }
  }
}
```

Claude Desktop 재시작 → 우상단 도구 아이콘에 `shokz-kb` 7개 도구 노출.

### Claude Code 등록
`~/.claude.json` 또는 프로젝트의 `.mcp.json`:
```json
{
  "mcpServers": {
    "shokz-kb": {
      "command": "node",
      "args": ["/absolute/path/to/eulpeul/mcp/stdio.mjs"],
      "env": { "VOYAGE_API_KEY": "pa-..." }
    }
  }
}
```

`/mcp` 슬래시 명령으로 활성화 확인.

## 2. Cloudflare Workers HTTP 배포

### 사전 준비
```bash
npm install -g wrangler
wrangler login
```

### 시크릿 등록
```bash
cd mcp
wrangler secret put VOYAGE_API_KEY
wrangler secret put MCP_BEARER_TOKEN   # 임의 강한 토큰 (32자 이상 권장)
```

### 배포
```bash
wrangler deploy
```

→ `https://shokz-kb-mcp.<subdomain>.workers.dev` 에서 동작.

### 동작 확인
```bash
curl https://shokz-kb-mcp.<sub>.workers.dev/healthz
# {"ok":true,"service":"shokz-kb-mcp"}
```

JSON-RPC 호출:
```bash
curl -X POST https://shokz-kb-mcp.<sub>.workers.dev/mcp \
  -H "Authorization: Bearer <MCP_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 외부 MCP 클라이언트 등록
Claude Desktop / Code 에 HTTP MCP 등록 시:
```json
{
  "mcpServers": {
    "shokz-kb-remote": {
      "url": "https://shokz-kb-mcp.<sub>.workers.dev/mcp",
      "headers": { "Authorization": "Bearer <MCP_BEARER_TOKEN>" }
    }
  }
}
```

## 3. 데이터 흐름

```
GitHub Pages (assets/data/*.json)
          │
          ├─ stdio.mjs   : 로컬 fs read (repo clone 필수)
          └─ worker.mjs  : edge fetch (5분 캐시)
                                  ↓
                          core.mjs (검색·매칭)
                                  ↓
                          tools.mjs (MCP tool wrappers)
                                  ↓
                          MCP client (Claude / Cursor / etc.)
```

## 4. 비용

| 항목 | 단가 | 월 예상 |
|---|---|---|
| Voyage 쿼리 임베딩 | $0.02/1M tokens | 1쿼리 ≈ 30 토큰 → $0.0000006 |
| Cloudflare Workers | 100K req/day 무료 | 내부팀 사용량 0 |
| KB 데이터 fetch | edge cached | 0 |

신규 광고주 매칭 100회/월 = **$0.0001** (사실상 0).

## 5. 보안 메모

- HTTP 엔드포인트는 Bearer 토큰으로만 인증 (단순). 토큰 누설 시 `wrangler secret put MCP_BEARER_TOKEN` 으로 회전.
- KB 데이터 자체는 GitHub Pages 에 공개돼 있으므로 토큰은 도구 호출 남용 방지용 rate limit 역할.
- `MCP_BEARER_TOKEN` 미설정 시 인증이 비활성화되니 배포 전 반드시 등록.
