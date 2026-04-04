/**
 * Cloudflare Worker - Naver Search Ads API Proxy
 *
 * Proxies REST requests to the Naver SA API, adding the required
 * HMAC-SHA256 signature headers.  Query parameters from the client
 * request (e.g. ?fields=bidAmt,contentsNetworkBidAmt) are forwarded
 * as-is to the upstream API for every HTTP method including PUT.
 */

const NAVER_API_BASE = 'https://api.searchad.naver.com';

/* ── helpers ─────────────────────────────────────────────────── */

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function buildNaverHeaders(method, path, apiKey, secretKey, customerId) {
  const timestamp = Date.now().toString();
  const message = `${timestamp}.${method}.${path}`;
  return hmacSha256(secretKey, message).then((signature) => ({
    'X-Timestamp': timestamp,
    'X-API-KEY': apiKey,
    'X-Customer': customerId,
    'X-Signature': signature,
  }));
}

/* ── auth ────────────────────────────────────────────────────── */

function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token !== env.AUTH_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null; // OK
}

/* ── CORS ────────────────────────────────────────────────────── */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/* ── proxy ───────────────────────────────────────────────────── */

async function proxyToNaver(request, env, path, search) {
  const method = request.method;

  // Build upstream URL — always include the client's query string
  const upstreamUrl = `${NAVER_API_BASE}${path}${search}`;

  const naverHeaders = await buildNaverHeaders(
    method,
    path,
    env.NAVER_API_KEY,
    env.NAVER_SECRET_KEY,
    env.NAVER_CUSTOMER_ID,
  );

  const headers = { ...naverHeaders };

  let body = null;
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/json';
    body = await request.text();
  }

  const resp = await fetch(upstreamUrl, { method, headers, body });

  const respHeaders = new Headers(resp.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => respHeaders.set(k, v));

  return new Response(resp.body, {
    status: resp.status,
    headers: respHeaders,
  });
}

/* ── entry ───────────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const authError = authenticate(request, env);
    if (authError) return authError;

    const url = new URL(request.url);
    const path = url.pathname;   // e.g. /ncc/adgroups/grp-xxx
    const search = url.search;   // e.g. ?fields=bidAmt,contentsNetworkBidAmt

    if (!path || path === '/') {
      return new Response(JSON.stringify({ status: 'ok', service: 'naver-sa-proxy' }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // The Naver SA API expects paths under /ncc/…
    // If the client already includes /ncc/ prefix, use as-is;
    // otherwise prepend /ncc.
    const apiPath = path.startsWith('/ncc/') ? path : `/ncc${path}`;

    return proxyToNaver(request, env, apiPath, search);
  },
};
