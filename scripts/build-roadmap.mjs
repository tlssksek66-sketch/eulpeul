/**
 * 운영 로드맵 빌더 — Phase 1.5
 * insights.json (PDF 인사이트 카드들) → SA / GFA 운영 플레이북 JSON
 *
 * 출력: assets/data/roadmap.json
 *   - summary           : 시장 요약 1~2줄
 *   - audiencePillars[] : 핵심 오디언스 4~5
 *   - saPlays[]         : 검색광고 셋업 플레이 3~5
 *   - gfaPlays[]        : 네이버 GFA 피드 셋업 플레이 3~5
 *   - caveats[]         : 주의사항
 *
 * 캐시 전략: insights.json 의 카드 URL Set 해시가 변하지 않으면 재생성 스킵
 * 비용: Claude Haiku 4.5, ~$0.02 per build
 */
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const INSIGHTS_FILE = path.join(REPO_ROOT, 'assets/data/insights.json');
const ROADMAP_FILE = path.join(REPO_ROOT, 'assets/data/roadmap.json');
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `당신은 디지털 광고 운영·미디어 플래너 시니어입니다.
주어진 리서치 인사이트 모음을 바탕으로 **검색광고(SA)와 네이버 GFA(모바일 피드)** 의 구체적인 캠페인 셋업 플레이를 도출하세요.

원칙:
1. 각 플레이는 인사이트 데이터에 직접 근거 — rationale 에 어떤 발견·수치를 활용했는지 자연어로 명시
2. SA setup 은 시드 키워드(6~12), 매칭 타입, 입찰 전략, 광고문안 톤, 랜딩 단서, KPI 까지 광고 운영자가 매니저에 그대로 입력 가능한 수준
3. GFA setup 은 데모 타겟(성/연령), 관심사 세그먼트, 노출 매체 우선순위(네이버 메인/밴드/블로그/카페 등), 소재 메시지 톤, CTA 카피, 빈도 cap, 입찰 전략, KPI
4. 추상적 표현 금지 — "효과적", "최적화" 같은 무의미한 단어 대신 구체 행동
5. 플레이는 서로 다른 산업·오디언스·전략각도를 커버 (중복 금지)
6. SA 3~5개 + GFA 3~5개

JSON 형식으로만 출력. 자연어 설명 금지.`;

const ROADMAP_SCHEMA = {
    type: 'object',
    properties: {
        summary: { type: 'string' },
        audiencePillars: { type: 'array', items: { type: 'string' } },
        saPlays: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    rationale: { type: 'string' },
                    targetIndustries: { type: 'array', items: { type: 'string' } },
                    targetAudiences: { type: 'array', items: { type: 'string' } },
                    seedKeywords: { type: 'array', items: { type: 'string' } },
                    negativeKeywords: { type: 'array', items: { type: 'string' } },
                    matchType: { type: 'string' },
                    biddingStrategy: { type: 'string' },
                    adCopyTone: { type: 'string' },
                    landingHint: { type: 'string' },
                    kpiTarget: { type: 'string' }
                },
                required: ['title', 'rationale', 'targetIndustries', 'targetAudiences', 'seedKeywords', 'negativeKeywords', 'matchType', 'biddingStrategy', 'adCopyTone', 'landingHint', 'kpiTarget'],
                additionalProperties: false
            }
        },
        gfaPlays: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    rationale: { type: 'string' },
                    targetIndustries: { type: 'array', items: { type: 'string' } },
                    targetAudiences: { type: 'array', items: { type: 'string' } },
                    demoTargeting: { type: 'string' },
                    interestSegments: { type: 'array', items: { type: 'string' } },
                    placements: { type: 'array', items: { type: 'string' } },
                    creativeMessage: { type: 'string' },
                    ctaCopy: { type: 'string' },
                    frequencyCap: { type: 'string' },
                    bidStrategy: { type: 'string' },
                    kpiTarget: { type: 'string' }
                },
                required: ['title', 'rationale', 'targetIndustries', 'targetAudiences', 'demoTargeting', 'interestSegments', 'placements', 'creativeMessage', 'ctaCopy', 'frequencyCap', 'bidStrategy', 'kpiTarget'],
                additionalProperties: false
            }
        },
        caveats: { type: 'array', items: { type: 'string' } }
    },
    required: ['summary', 'audiencePillars', 'saPlays', 'gfaPlays', 'caveats'],
    additionalProperties: false
};

function nowKstIso() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;
}

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }

function buildPayload(insights) {
    // 응축 페이로드: 인사이트 카드별 하이라이트만 추출 (~1줄/카드)
    const cards = insights.map((c, i) => {
        const ins = c.insight;
        return [
            `[#${i + 1} ${c.publisher} · ${c.title}]`,
            `pitch: ${ins.pitchHook}`,
            `findings: ${(ins.coreFindings || []).join(' / ')}`,
            `metrics: ${(ins.metrics || []).map(m => `${m.label}=${m.value}${m.context ? `(${m.context})` : ''}`).join(' / ')}`,
            `brands: ${(ins.brands || []).join(', ')}`,
            `platforms: ${(ins.platforms || []).join(', ')}`,
            `audiences: ${(ins.audienceSegments || []).join(', ')}`,
            `industries: ${(ins.industries || []).join(', ')}`,
            `usage: ${ins.usageContext}`
        ].join('\n');
    }).join('\n---\n');

    return `[리서치 인사이트 카드 ${insights.length}건 응축 데이터]\n\n${cards}\n\n위 인사이트를 근거로 SA 3~5개 / GFA 3~5개 플레이를 도출하세요.`;
}

async function main() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('FATAL: ANTHROPIC_API_KEY 가 필요합니다.');
        process.exit(1);
    }
    const insightsData = loadJson(INSIGHTS_FILE, null);
    if (!insightsData?.byUrl) {
        console.error('insights.json 이 비어 있습니다. extract-insights 먼저 실행.');
        process.exit(0);
    }
    const cards = Object.entries(insightsData.byUrl)
        .filter(([, v]) => v.insight)
        .map(([url, v]) => ({ url, ...v }));

    if (cards.length === 0) {
        console.error('인사이트 카드가 0건입니다.');
        process.exit(0);
    }

    // 캐시: 카드 URL Set 의 SHA1 → 변경 없으면 스킵
    const cardsHash = crypto.createHash('sha1').update(cards.map(c => c.url).sort().join('|')).digest('hex').slice(0, 12);
    const existing = loadJson(ROADMAP_FILE, null);
    if (existing?.meta?.cardsHash === cardsHash && process.env.ROADMAP_FORCE !== '1') {
        console.log(`[roadmap] cards unchanged (hash=${cardsHash}) — skip.`);
        process.exit(0);
    }

    console.log(`[roadmap] cards: ${cards.length}, hash: ${cardsHash}`);
    console.log(`[roadmap] payload chars: ${cards.length > 0 ? buildPayload(cards).length : 0}`);
    const client = new Anthropic();
    const userMessage = buildPayload(cards);

    const t0 = Date.now();
    let response;
    try {
        response = await client.messages.create({
            model: MODEL,
            max_tokens: 8192,
            system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: userMessage }],
            output_config: { format: { type: 'json_schema', schema: ROADMAP_SCHEMA } }
        });
    } catch (apiErr) {
        console.error('[roadmap] API call failed:', apiErr.status || '', apiErr.message);
        if (apiErr.error) console.error('[roadmap] error body:', JSON.stringify(apiErr.error));
        throw apiErr;
    }
    const ms = Date.now() - t0;

    if (response.stop_reason && response.stop_reason !== 'end_turn') {
        console.warn(`[roadmap] stop_reason=${response.stop_reason} (응답이 잘렸을 수 있음)`);
    }

    let roadmap = null;
    let rawText = '';
    for (const block of response.content) {
        if (block.type === 'text') {
            rawText = block.text;
            try { roadmap = JSON.parse(block.text); }
            catch (parseErr) {
                console.error('[roadmap] JSON parse failed:', parseErr.message);
                console.error('[roadmap] raw response (first 800 chars):\n' + block.text.slice(0, 800));
                throw parseErr;
            }
            break;
        }
    }
    if (!roadmap) {
        console.error('[roadmap] no text block in response. content blocks:', response.content.map(b => b.type).join(', '));
        throw new Error('roadmap parse failed — no text block');
    }

    const usage = response.usage || {};
    const cost = (usage.input_tokens || 0) / 1_000_000 * 1.0 +
                 (usage.output_tokens || 0) / 1_000_000 * 5.0 +
                 (usage.cache_read_input_tokens || 0) / 1_000_000 * 0.1 +
                 (usage.cache_creation_input_tokens || 0) / 1_000_000 * 1.25;

    const output = {
        meta: {
            builtAt: nowKstIso(),
            cardsHash,
            cardsCount: cards.length,
            model: MODEL,
            buildMs: ms,
            usage: {
                input_tokens: usage.input_tokens || 0,
                output_tokens: usage.output_tokens || 0,
                cache_read_input_tokens: usage.cache_read_input_tokens || 0,
                cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
                estimated_cost_usd: Number(cost.toFixed(4))
            }
        },
        ...roadmap
    };

    fs.writeFileSync(ROADMAP_FILE, JSON.stringify(output, null, 2));
    console.log(`[roadmap] done.`);
    console.log(`  SA plays: ${roadmap.saPlays.length}, GFA plays: ${roadmap.gfaPlays.length}`);
    console.log(`  cost: $${cost.toFixed(4)} (${ms}ms)`);
}

main().catch(err => {
    console.error('[roadmap] FATAL:', err);
    process.exit(1);
});
