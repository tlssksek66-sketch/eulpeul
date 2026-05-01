import { Env, NoticeClassified } from './types';

export async function notifySlack(notices: NoticeClassified[], env: Env): Promise<void> {
  if (notices.length === 0) return;

  const directImpact = notices.filter(n => n.shokzImpact === '직접');
  const indirectImpact = notices.filter(n => n.shokzImpact === '간접');
  const highSales = notices.filter(n => n.salesValue === '높음');

  if (directImpact.length === 0 && highSales.length === 0) return;

  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  let text = `🔔 네이버 광고 공지 신규 ${notices.length}건 감지 (${today})\n\n`;

  if (directImpact.length > 0) {
    text += `*[SHOKZ 직접 영향 — ${directImpact.length}건]*\n`;
    for (const n of directImpact) {
      text += `• ${n.date} ${n.title}\n  → ${n.summary}\n  ${n.url}\n\n`;
    }
  }

  if (indirectImpact.length > 0) {
    text += `*[SHOKZ 간접 영향 — ${indirectImpact.length}건]*\n`;
    for (const n of indirectImpact) {
      text += `• ${n.date} ${n.title}\n  ${n.url}\n\n`;
    }
  }

  if (highSales.length > 0) {
    text += `*[영업 활용 가치 높음 — ${highSales.length}건]*\n`;
    for (const n of highSales) {
      const cats = n.salesCategories.join('·');
      text += `• ${n.date} [${cats}] ${n.title}\n  ${n.url}\n\n`;
    }
  }

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: env.SLACK_CHANNEL_ID,
      text,
      mrkdwn: true
    })
  });
}
