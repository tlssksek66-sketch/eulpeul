/**
 * MCP 툴 정의 — 양 surface (stdio / Worker) 가 공유.
 *
 * 각 툴은:
 *   - name        : MCP tool name
 *   - description : 사용자(LLM) 가 어떤 상황에 호출할지 결정하는 자연어 설명
 *   - inputSchema : JSON Schema (입력 검증)
 *   - handler(kb, args, env) → result (JSON-serializable)
 *
 * env: { voyageApiKey } 등 surface 별 secret 주입
 */
import {
    searchInsights,
    matchAdvertiser,
    getCardByUrl,
    getRoadmap,
    listMeta,
    getNeighbors,
    listCards
} from './core.mjs';

export const TOOLS = [
    {
        name: 'search_insights',
        description: '자유 텍스트 쿼리로 인사이트 KB 를 시맨틱 검색합니다. 광고 운영·영업 제안 시 관련 데이터 포인트·수치·인용을 빠르게 찾을 때 사용. 한국어 쿼리 권장. 예: "30대 여성 모바일 쇼핑 트렌드", "OTT 광고 요금제 효과".',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '시맨틱 검색 쿼리 (한국어 가능)' },
                k: { type: 'number', description: '상위 N건 (기본 5, 최대 20)', default: 5 }
            },
            required: ['query']
        },
        async handler(kb, args, env) {
            const k = Math.min(Math.max(args.k || 5, 1), 20);
            return searchInsights(kb, { query: args.query, k, voyageApiKey: env.voyageApiKey });
        }
    },
    {
        name: 'match_advertiser',
        description: '광고주 정보(산업·오디언스·KPI 키워드)에 매칭되는 인사이트 카드 + SA/GFA 운영 플레이를 반환합니다. 신규 광고주 제안서 작성·기존 광고주 운영 전략 수립 시 호출. industry/audience 둘 중 하나만 줘도 동작 (자유 query 추가 가능).',
        inputSchema: {
            type: 'object',
            properties: {
                industry: { type: 'string', description: '광고주 산업 (예: "이커머스", "뷰티·화장품", "OTT")' },
                audience: { type: 'string', description: '타겟 오디언스 (예: "20대 여성", "30대 직장인")' },
                query: { type: 'string', description: '추가 자유 텍스트 (예: "모바일 쇼핑 전환율 강조")' },
                k: { type: 'number', description: '상위 N 카드 (기본 3)', default: 3 }
            }
        },
        async handler(kb, args, env) {
            const k = Math.min(Math.max(args.k || 3, 1), 10);
            return matchAdvertiser(kb, {
                industry: args.industry,
                audience: args.audience,
                query: args.query,
                k,
                voyageApiKey: env.voyageApiKey
            });
        }
    },
    {
        name: 'get_card',
        description: '인사이트 카드 URL 로 전체 상세를 반환합니다. search_insights / match_advertiser 결과의 hit 을 펼쳐서 인용·근거 작성할 때 사용.',
        inputSchema: {
            type: 'object',
            properties: { url: { type: 'string', description: '카드 PDF URL' } },
            required: ['url']
        },
        async handler(kb, args) {
            const c = getCardByUrl(kb, args.url);
            if (!c) return { error: 'card not found', url: args.url };
            return c;
        }
    },
    {
        name: 'get_roadmap',
        description: '현재 운영 로드맵 전체(시장 요약·오디언스 필러·SA/GFA 플레이·주의사항)를 반환합니다. 광고주 매칭 없이 전체 전략 개요가 필요할 때.',
        inputSchema: { type: 'object', properties: {} },
        async handler(kb) { return getRoadmap(kb); }
    },
    {
        name: 'list_meta',
        description: '인사이트 KB 의 메타 리스트(산업·브랜드·플랫폼·오디언스 Top N + 빈도)를 반환합니다. 광고주 산업 분류·경쟁 매체 파악·오디언스 전략 수립 시.',
        inputSchema: {
            type: 'object',
            properties: {
                kind: {
                    type: 'string',
                    enum: ['industry', 'brand', 'platform', 'audience'],
                    description: '조회할 메타 유형'
                }
            },
            required: ['kind']
        },
        async handler(kb, args) { return { kind: args.kind, items: listMeta(kb, args.kind) }; }
    },
    {
        name: 'get_neighbors',
        description: '특정 카드와 시맨틱하게 유사한 다른 카드 Top K (사전 계산된 코사인 거리 기반). 같은 광고주에게 함께 제시할 수 있는 보강 데이터 포인트를 찾을 때.',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                k: { type: 'number', default: 5 }
            },
            required: ['url']
        },
        async handler(kb, args) {
            return { url: args.url, neighbors: getNeighbors(kb, args.url, args.k || 5) };
        }
    },
    {
        name: 'list_all_cards',
        description: '모든 인사이트 카드의 간략 정보(URL·제목·발행처·날짜·pitchHook)를 반환합니다. 전체 KB 스캔 / overview 가 필요할 때.',
        inputSchema: { type: 'object', properties: {} },
        async handler(kb) {
            return {
                count: listCards(kb).length,
                cards: listCards(kb).map(c => ({
                    url: c.url,
                    title: c.title,
                    publisher: c.publisher,
                    date: c.date,
                    pitchHook: c.insight?.pitchHook,
                    industries: c.insight?.industries || []
                }))
            };
        }
    }
];

export function findTool(name) {
    return TOOLS.find(t => t.name === name);
}
