import { Env, NoticeRaw } from './types';

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';

const COLLECTION_PROMPT = `ads.naver.com/notice 페이지에서 최신 광고주 공지 30건을 JSON 배열로 반환해줘.

각 항목에 다음 필드 포함:
- date: 발행일 (YYYY-MM-DD 형식)
- title: 공지 제목 (원문 그대로)
- noticeId: notice/숫자 패턴의 공지 ID (숫자만, 예: "31108")
- url: 전체 URL (https://ads.naver.com/notice/{noticeId} 형식)
- category: "검색광고" / "디스플레이광고" / "일반" / "기타" 중 하나

JSON 배열 외 다른 텍스트는 출력하지 말고, 신뢰할 수 있는 정보만 포함해줘.
상단 '중요' 고정 공지는 중복 제거. "공통" 카테고리는 "일반"으로 매핑.`;

export async function fetchLatestNotices(env: Env): Promise<NoticeRaw[]> {
  const response = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: COLLECTION_PROMPT }],
      web_search_options: { search_context_size: 'medium' }
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity API ${response.status}: ${await response.text()}`);
  }

  const data: any = await response.json();
  const content: string = data.choices[0].message.content;

  // JSON 추출 결 — 응답이 ```json 래퍼로 감쌀 가능성 결 처리
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Perplexity response');
  }

  const parsed: NoticeRaw[] = JSON.parse(jsonMatch[0]);

  // URL 정규화 결 — page 파라미터 제거
  return parsed.map(n => ({
    ...n,
    url: `https://ads.naver.com/notice/${n.noticeId}`
  }));
}

export async function fetchNoticeFullText(noticeId: string, env: Env): Promise<string> {
  const response = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{
        role: 'user',
        content: `https://ads.naver.com/notice/${noticeId} 페이지의 본문 전문을 마크다운으로 반환해줘. 제목·본문·이미지 캡션 모두 포함. 다른 설명 없이 본문만.`
      }],
      web_search_options: { search_context_size: 'high' }
    })
  });

  const data: any = await response.json();
  return data.choices[0].message.content;
}

/**
 * 진단용 — Perplexity 호출 → raw 응답 + 파싱 시도 결과 모두 반환
 */
export async function debugPerplexityCollection(env: Env): Promise<{
  httpStatus: number;
  rawContent: string;
  contentLength: number;
  hasJsonArrayMatch: boolean;
  matchedSubstring: string;
  parsedCount: number;
  parsedSample: NoticeRaw[] | null;
  parseError?: string;
  apiError?: string;
}> {
  const response = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: COLLECTION_PROMPT }],
      web_search_options: { search_context_size: 'medium' }
    })
  });
  const httpStatus = response.status;
  const text = await response.text();

  if (!response.ok) {
    return {
      httpStatus,
      rawContent: text.slice(0, 4000),
      contentLength: text.length,
      hasJsonArrayMatch: false,
      matchedSubstring: '',
      parsedCount: 0,
      parsedSample: null,
      apiError: `HTTP ${httpStatus}`
    };
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e: any) {
    return {
      httpStatus,
      rawContent: text.slice(0, 4000),
      contentLength: text.length,
      hasJsonArrayMatch: false,
      matchedSubstring: '',
      parsedCount: 0,
      parsedSample: null,
      apiError: 'response body not JSON: ' + (e?.message ?? '')
    };
  }

  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    return {
      httpStatus,
      rawContent: content.slice(0, 4000),
      contentLength: content.length,
      hasJsonArrayMatch: false,
      matchedSubstring: '',
      parsedCount: 0,
      parsedSample: null
    };
  }

  try {
    const parsed: NoticeRaw[] = JSON.parse(jsonMatch[0]);
    return {
      httpStatus,
      rawContent: content.slice(0, 2000),
      contentLength: content.length,
      hasJsonArrayMatch: true,
      matchedSubstring: jsonMatch[0].slice(0, 500),
      parsedCount: parsed.length,
      parsedSample: parsed.slice(0, 3)
    };
  } catch (e: any) {
    return {
      httpStatus,
      rawContent: content.slice(0, 4000),
      contentLength: content.length,
      hasJsonArrayMatch: true,
      matchedSubstring: jsonMatch[0].slice(0, 500),
      parsedCount: 0,
      parsedSample: null,
      parseError: e?.message ?? String(e)
    };
  }
}
