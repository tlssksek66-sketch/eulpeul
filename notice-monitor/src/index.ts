import { Env, NoticeClassified } from './types';
import { fetchLatestNotices, fetchNoticeFullText } from './perplexity';
import { classifyNotice } from './claude';
import { appendToSheets } from './sheets';
import { appendToNotion } from './notion';
import { notifySlack } from './slack';
import { handleAdmin } from './admin';

const KV_KEY = 'seen-ids';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMonitor(env));
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // 관리 엔드포인트 — Bearer ADMIN_AUTH_TOKEN 필요
    if (url.pathname.startsWith('/admin/')) {
      const r = await handleAdmin(req, env, ctx, runMonitor);
      return r ?? new Response('Not found', { status: 404 });
    }

    // 호환용 레거시 트리거 — 키 기반 (수동 검증용)
    if (url.pathname === '/trigger') {
      const key = url.searchParams.get('key');
      if (key !== 'shokz-progress-media-2026') {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const result = await runMonitor(env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(`Error: ${e?.message ?? String(e)}`, { status: 500 });
      }
    }

    return new Response('OK', { status: 200 });
  }
};

/**
 * 메인 파이프라인.
 *  - dryRun: 분류까지만 진행, Sheets/Notion/Slack/KV 적재·푸시 모두 스킵.
 */
export async function runMonitor(
  env: Env,
  opts: { dryRun?: boolean } = {}
): Promise<{
  collected: number;
  new: number;
  classified?: NoticeClassified[];
  dryRun?: boolean;
}> {
  const dryRun = !!opts.dryRun;

  // 1. 수집
  const notices = await fetchLatestNotices(env);

  // 2. KV diff
  const seenIdsRaw = await env.NOTICE_KV.get(KV_KEY);
  const seenIds: Set<string> = new Set(seenIdsRaw ? JSON.parse(seenIdsRaw) : []);

  const newNotices = notices.filter(n => !seenIds.has(n.noticeId));

  if (newNotices.length === 0) {
    return { collected: notices.length, new: 0, dryRun };
  }

  // 3. 분류
  const classified: NoticeClassified[] = [];
  for (const n of newNotices) {
    const cls = await classifyNotice(n, env);
    const item: NoticeClassified = {
      ...n,
      ...cls,
      firstSeen: new Date().toISOString()
    };

    // 4. 본문 전문 수집 — 영업가치 높음만 (dry-run 에서는 스킵하여 비용 0)
    if (!dryRun && item.salesValue === '높음') {
      try {
        item.fullText = await fetchNoticeFullText(n.noticeId, env);
      } catch (e) {
        console.error(`Full text fetch failed: ${n.noticeId}`, e);
      }
    }

    classified.push(item);
  }

  // dry-run: 분류 결과만 반환 (적재·푸시·KV 갱신 모두 스킵)
  if (dryRun) {
    return {
      collected: notices.length,
      new: classified.length,
      classified,
      dryRun: true
    };
  }

  // 5. 적재 — Sheets (전체) + Notion (영업가치 높음만)
  await appendToSheets(classified, env);
  for (const n of classified) {
    if (n.salesValue === '높음') {
      try {
        await appendToNotion(n, env);
      } catch (e) {
        console.error(`Notion append failed: ${n.noticeId}`, e);
      }
    }
  }

  // 6. Slack 알림 (직접 영향 + 영업가치 높음 분리, slack.ts 가 게이트)
  await notifySlack(classified, env);

  // 7. KV 업데이트 — 이번 수집의 전체 ID 로 덮어쓰기 (구건 자동 만료)
  const allIds = notices.map(n => n.noticeId);
  await env.NOTICE_KV.put(KV_KEY, JSON.stringify(allIds));

  return { collected: notices.length, new: classified.length };
}
