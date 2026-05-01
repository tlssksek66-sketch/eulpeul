/**
 * MCP Streamable HTTP 서버 — Cloudflare Workers
 *
 * 모바일·웹·외부 MCP 클라이언트가 HTTPS 로 KB 쿼리 가능.
 *
 * 엔드포인트:
 *   POST /mcp        — JSON-RPC 2.0 (initialize / tools/list / tools/call)
 *   GET  /healthz    — 헬스체크
 *   GET  /           — 안내 페이지
 *
 * Workers 시크릿 (wrangler secret put):
 *   VOYAGE_API_KEY   — Voyage AI 임베딩
 *   MCP_BEARER_TOKEN — 단순 인증 (Authorization: Bearer ...)
 *
 * KB 데이터는 GitHub Pages 에서 fetch — Cloudflare edge cache 5분.
 */
import { TOOLS, findTool } from './tools.mjs';

const KB_BASE = 'https://tlssksek66-sketch.github.io/eulpeul/assets/data';
const KB_FILES = ['insights', 'roadmap', 'embeddings', 'neighbors'];
const CACHE_TTL = 300; // 5분

async function fetchJson(url) {
    const res = await fetch(url, { cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });
    if (!res.ok) throw new Error(`KB fetch ${res.status} ${url}`);
    return res.json();
}

async function loadKB() {
    const [insights, roadmap, embeddings, neighbors] = await Promise.all(
        KB_FILES.map(f => fetchJson(`${KB_BASE}/${f}.json`).catch(err => {
            console.error(`KB ${f}.json failed:`, err.message);
            return f === 'roadmap' ? {} : { byUrl: {} };
        }))
    );
    return { insights, roadmap, embeddings, neighbors };
}

/* ---------- JSON-RPC helpers ---------- */
const jsonrpc = (id, result) => ({ jsonrpc: '2.0', id, result });
const jsonrpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id, error: { code, message, data } });

const SERVER_INFO = {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    serverInfo: { name: 'shokz-kb', version: '0.1.0' }
};

async function handleRpc(body, env) {
    const { jsonrpc: ver, id, method, params } = body;
    if (ver !== '2.0') return jsonrpcError(id ?? null, -32600, 'invalid jsonrpc version');

    if (method === 'initialize') return jsonrpc(id, SERVER_INFO);

    if (method === 'notifications/initialized' || method === 'initialized') {
        return null; // notification, no response
    }

    if (method === 'tools/list') {
        return jsonrpc(id, {
            tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
        });
    }

    if (method === 'tools/call') {
        const { name, arguments: args } = params || {};
        const tool = findTool(name);
        if (!tool) return jsonrpcError(id, -32601, `unknown tool: ${name}`);
        try {
            const kb = await loadKB();
            const result = await tool.handler(kb, args || {}, { voyageApiKey: env.VOYAGE_API_KEY });
            return jsonrpc(id, {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            });
        } catch (err) {
            return jsonrpc(id, {
                content: [{ type: 'text', text: JSON.stringify({ error: err.message, tool: name }) }],
                isError: true
            });
        }
    }

    return jsonrpcError(id ?? null, -32601, `method not found: ${method}`);
}

function checkAuth(req, env) {
    const expected = env.MCP_BEARER_TOKEN;
    if (!expected) return true; // 미설정 시 인증 비활성 (개발용)
    const auth = req.headers.get('Authorization') || '';
    return auth === `Bearer ${expected}`;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
};

const HOME_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>SHOKZ KB MCP</title>
<style>body{font-family:system-ui;max-width:680px;margin:48px auto;padding:0 20px;color:#222;line-height:1.6}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px}
.tag{display:inline-block;background:#0099E5;color:white;padding:2px 8px;border-radius:4px;font-size:11px;letter-spacing:.05em}
</style></head><body>
<h1>SHOKZ KB · MCP HTTP <span class="tag">v0.1</span></h1>
<p>Cloudflare Workers 호스팅 MCP 서버. SHOKZ 광고 인사이트 KB · 운영 로드맵 · 시맨틱 검색을 HTTPS 로 제공.</p>
<h3>엔드포인트</h3>
<ul>
  <li><code>POST /mcp</code> — JSON-RPC 2.0</li>
  <li><code>GET /healthz</code> — 헬스체크</li>
</ul>
<h3>인증</h3>
<p><code>Authorization: Bearer &lt;MCP_BEARER_TOKEN&gt;</code></p>
<h3>도구</h3>
<ul>
  <li>search_insights / match_advertiser / get_card / get_roadmap / list_meta / get_neighbors / list_all_cards</li>
</ul>
</body></html>`;

export default {
    async fetch(req, env) {
        const url = new URL(req.url);

        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (url.pathname === '/healthz') {
            return new Response(JSON.stringify({ ok: true, service: 'shokz-kb-mcp' }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (url.pathname === '/' || url.pathname === '') {
            return new Response(HOME_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        if (url.pathname !== '/mcp') {
            return new Response('Not found', { status: 404, headers: corsHeaders });
        }

        if (req.method !== 'POST') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        if (!checkAuth(req, env)) {
            return new Response(JSON.stringify({ error: 'unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return new Response(JSON.stringify(jsonrpcError(null, -32700, 'parse error')), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        try {
            const result = await handleRpc(body, env);
            if (result === null) {
                return new Response(null, { status: 204, headers: corsHeaders });
            }
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        } catch (err) {
            return new Response(
                JSON.stringify(jsonrpcError(body?.id ?? null, -32603, 'internal error', err.message)),
                { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }
    }
};
