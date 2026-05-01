import { Env, NoticeClassified } from './types';
import { fetchLatestNotices, fetchNoticeFullText } from './perplexity';
import { classifyNotice } from './claude';
import { appendToSheets } from './sheets';
import { appendToNotion } from './notion';
import { notifySlack } from './slack';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMonitor(env));
  },

  // 본 자리 수동 트리거 결 — POST /trigger?key=... (테스트용)
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/trigger') {
      const key = url.searchParams.get('key');
      if (key !== 'shokz-progress-media-2026') {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const result = await runMonitor(env);
        return new Response(JSON.stringify(result), { status: 200 });
      } catch (e: any) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }
    return new Response('OK', { status: 200 });
  }
};

async function runMonitor(env: Env): Promise<{ collected: number; new: number }> {
  // 1. 수집
  const notices = await fetchLatestNotices(env);

  // 2. KV diff 결
  const seenIdsRaw = await env.NOTICE_KV.get('seen-ids');
  const seenIds: Set<string> = new Set(seenIdsRaw ? JSON.parse(seenIdsRaw) : []);

  const newNotices = notices.filter(n => !seenIds.has(n.noticeId));

  if (newNotices.length === 0) {
    return { collected: notices.length, new: 0 };
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

    // 4. 본문 전문 수집 결 (영업가치 높음만)
    if (item.salesValue === '높음') {
      try {
        item.fullText = await fetchNoticeFullText(n.noticeId, env);
      } catch (e) {
        // 본문 수집 실패 자리 — 본 모듈 진행에는 영향 없음
        console.error(`Full text fetch failed: ${n.noticeId}`, e);
      }
    }

    classified.push(item);
  }

  // 5. 적재 결 — Sheets (전체) + Notion (영업가치 높음만)
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

  // 6. Slack 알림
  await notifySlack(classified, env);

  // 7. KV 업데이트 결
  const allIds = notices.map(n => n.noticeId);
  await env.NOTICE_KV.put('seen-ids', JSON.stringify(allIds));

  return { collected: notices.length, new: classified.length };
}
