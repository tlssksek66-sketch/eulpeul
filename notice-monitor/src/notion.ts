import { Env, NoticeClassified } from './types';

const NOTION_API = 'https://api.notion.com/v1';

export async function appendToNotion(notice: NoticeClassified, env: Env): Promise<void> {
  // 영업가치 높음만 본 함수 호출 결
  await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DATABASE_ID },
      properties: {
        '제목': { title: [{ text: { content: notice.title } }] },
        '발행일': { date: { start: notice.date } },
        '공지ID': { rich_text: [{ text: { content: notice.noticeId } }] },
        'URL': { url: notice.url },
        '영업활용가치': { select: { name: notice.salesValue } },
        '영업카테고리': {
          multi_select: notice.salesCategories.map(c => ({ name: c }))
        },
        '핵심요약': { rich_text: [{ text: { content: notice.summary } }] }
      },
      children: notice.fullText ? [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: notice.fullText.slice(0, 2000) } }]
          }
        }
      ] : []
    })
  });
}
