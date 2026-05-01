import { Env, NoticeRaw } from './types';
import { classifyNotice } from './claude';

const KV_KEY = 'seen-ids';

export type RunMonitorFn = (env: Env, opts?: { dryRun?: boolean }) => Promise<any>;

function authorized(req: Request, env: Env): boolean {
  const auth = req.headers.get('Authorization') || '';
  return auth === `Bearer ${env.ADMIN_AUTH_TOKEN}`;
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

/**
 * /admin/* 라우팅. 매칭되지 않으면 null 반환 (호출자가 다른 처리 결정).
 */
export async function handleAdmin(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  runMonitor: RunMonitorFn
): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/admin/')) return null;

  if (!authorized(req, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // 1. /admin/status — KV 상태 + env 점검 + 헬스체크
  if (url.pathname === '/admin/status') {
    const seenIdsRaw = await env.NOTICE_KV.get(KV_KEY);
    const seenIds: string[] = seenIdsRaw ? JSON.parse(seenIdsRaw) : [];
    return jsonResponse({
      ok: true,
      version: 'v2',
      now: new Date().toISOString(),
      kv: {
        key: KV_KEY,
        seenCount: seenIds.length,
        latestSeenIds: seenIds.slice(-10)
      },
      secrets: {
        perplexity: !!env.PERPLEXITY_API_KEY,
        anthropic: !!env.ANTHROPIC_API_KEY,
        googleSheets: !!(env.GOOGLE_SHEETS_ID && env.GOOGLE_SERVICE_ACCOUNT_JSON),
        notion: !!(env.NOTION_API_KEY && env.NOTION_DATABASE_ID),
        slack: !!(env.SLACK_BOT_TOKEN && env.SLACK_CHANNEL_ID),
        admin: !!env.ADMIN_AUTH_TOKEN
      },
      cron: ['0 0 * * *', '0 9 * * *']
    });
  }

  // 2. /admin/run / /admin/run?dry=1 — 수동 트리거
  if (url.pathname === '/admin/run') {
    const dry = url.searchParams.get('dry') === '1';
    try {
      const result = await runMonitor(env, { dryRun: dry });
      return jsonResponse({ ok: true, dryRun: dry, ...result });
    } catch (e: any) {
      return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
    }
  }

  // 3. /admin/reset — seen-ids 비움 (다음 실행에서 전체 재처리)
  if (url.pathname === '/admin/reset') {
    await env.NOTICE_KV.delete(KV_KEY);
    return jsonResponse({ ok: true, action: 'reset', cleared: KV_KEY });
  }

  // 4. /admin/unmark?id=NOTICE_ID — 특정 noticeId 만 제외 (1건 재처리)
  if (url.pathname === '/admin/unmark') {
    const id = url.searchParams.get('id');
    if (!id) return jsonResponse({ error: 'missing id query param' }, 400);
    const seenIdsRaw = await env.NOTICE_KV.get(KV_KEY);
    const seenIds: string[] = seenIdsRaw ? JSON.parse(seenIdsRaw) : [];
    const before = seenIds.length;
    const filtered = seenIds.filter(x => x !== id);
    await env.NOTICE_KV.put(KV_KEY, JSON.stringify(filtered));
    return jsonResponse({
      ok: true,
      action: 'unmark',
      id,
      removed: before !== filtered.length,
      before,
      after: filtered.length
    });
  }

  // 5. /admin/classify-test — POST { date, title, noticeId, url, category } → 분류 결과만 반환 (적재 X)
  if (url.pathname === '/admin/classify-test') {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'POST required with NoticeRaw body' }, 405);
    }
    let body: NoticeRaw;
    try {
      body = (await req.json()) as NoticeRaw;
    } catch {
      return jsonResponse({ error: 'invalid JSON body' }, 400);
    }
    const required = ['date', 'title', 'noticeId', 'url', 'category'];
    const missing = required.filter(k => !(k in body));
    if (missing.length > 0) {
      return jsonResponse({ error: 'missing fields', missing }, 400);
    }
    try {
      const cls = await classifyNotice(body, env);
      return jsonResponse({ ok: true, input: body, classification: cls });
    } catch (e: any) {
      return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
    }
  }

  return jsonResponse({ error: 'unknown admin path', pathname: url.pathname }, 404);
}
