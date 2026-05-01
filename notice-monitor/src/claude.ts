import { Env, NoticeRaw, NoticeClassified } from './types';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

const CLASSIFY_PROMPT = (n: NoticeRaw) => `다음 네이버 광고 공지를 분석해줘:

제목: ${n.title}
날짜: ${n.date}
카테고리: ${n.category}
URL: ${n.url}

다음 4축으로 분류해서 JSON으로 반환:

{
  "shokzImpact": "직접" | "간접" | "무관",
  "salesValue": "높음" | "중간" | "낮음",
  "salesCategories": ["디지털가전", "패션", ...],
  "summary": "한 줄 요약 (50자 이내)"
}

분류 기준:

shokzImpact:
- 직접: SHOKZ 캠페인 운영에 즉시 영향 (입찰가·소재·캠페인 구조·노출 영역·카테고리 매핑)
  · SHOKZ는 무선이어폰(오픈이어/골전도) 디지털가전 카테고리, 네이버 SA(SP00·SP01~05·SPB)+GFA 운영
- 간접: 검색·노출·UI 환경 변화로 영향 가능 (즉시 액션은 없으나 모니터링 필요)
- 무관: SHOKZ와 무관 (지역체계·세무·신용카드 등)

salesValue:
- 높음: 광고주 향 영업 메일·자료에 즉시 인용 가능 (시점 명분 강함, 카테고리 직접 매핑)
- 중간: 일부 카테고리 광고주에 활용 가능
- 낮음: 영업 활용 자리 부족

salesCategories: 영업 카테고리 매칭 — "디지털가전", "패션", "식음료", "가구인테리어", "뷰티", "일반" 중 해당하는 것 모두

summary: 핵심 변화 한 줄 (50자 이내, 운영자가 즉시 이해 가능한 결)

JSON 외 다른 텍스트 출력 금지.`;

export async function classifyNotice(notice: NoticeRaw, env: Env): Promise<Omit<NoticeClassified, keyof NoticeRaw | 'fullText' | 'firstSeen'>> {
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: CLASSIFY_PROMPT(notice) }]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API ${response.status}: ${await response.text()}`);
  }

  const data: any = await response.json();
  const content: string = data.content[0].text;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    ...parsed,
    classifiedAt: new Date().toISOString()
  };
}
