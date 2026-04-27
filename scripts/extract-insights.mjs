/**
 * 리서치 PDF 인사이트 추출기 — Phase 1
 * - Claude Haiku 4.5 모델 사용 ($1/$5 per 1M tokens)
 * - Prompt caching: system prompt 캐시 (~10x 비용 절감)
 * - Structured outputs: JSON Schema 강제 → 파싱 안정성
 *
 * 입력: assets/data/reports.json (PDF 메타데이터)
 * 출력: assets/data/insights.json (인사이트 카드)
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY        (필수)
 *   INSIGHT_MAX_PDFS         (기본 10) — 한 번에 처리할 최대 PDF 수
 *   INSIGHT_TEXT_CHAR_LIMIT  (기본 40000) — PDF 본문 잘라내기 (~10K 토큰)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { analyzePdf } from './analyze-pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const REPORTS_FILE = path.join(REPO_ROOT, 'assets/data/reports.json');
const INSIGHTS_FILE = path.join(REPO_ROOT, 'assets/data/insights.json');
const MAX_PDFS = Number(process.env.INSIGHT_MAX_PDFS || 10);
const TEXT_CHAR_LIMIT = Number(process.env.INSIGHT_TEXT_CHAR_LIMIT || 40000);
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `당신은 디지털 미디어·광고 시장 인사이트 분석가입니다.

주어진 리서치 PDF 본문에서 **광고 운영 실무자와 광고 영업 담당자가 즉시 활용할 수 있는** 구조화된 인사이트를 추출하세요.

추출 원칙:
1. 추상적 표현("주목할 만하다") 대신 구체적 데이터 포인트("거래액 8조 원, 전년 대비 38% 증가")를 우선
2. 브랜드명·플랫폼명·매체명은 원문에 등장한 그대로 (네이버 쇼핑, 쿠팡, 메타, 등)
3. 핵심 발견은 한 문장에 한 가지 사실 — bullet 포인트 풀어쓰지 말 것
4. 광고주 활용 맥락은 "어떤 업종의 어떤 광고주에게 어떤 메시지·전략으로" 한 줄로 압축
5. 제안서 첫 문장(pitchHook)은 광고주 의사결정자가 5초 안에 가치를 느끼도록

추출 항목:
- coreFindings (배열, 최대 5개): 리포트의 핵심 발견 — 각 한 줄, 수치 포함 우선
- metrics (배열): 구체 수치 — { label, value, context(선택) }. 예: {label: "거래액", value: "8조 원", context: "쿠팡 1분기"}
- brands (배열): 언급된 주요 브랜드명
- platforms (배열): 언급된 매체·플랫폼 (네이버, 카카오, 인스타그램 등)
- audienceSegments (배열): 타겟 오디언스 (예: "30대 여성 직장인", "Z세대 학생")
- industries (배열): 산업·업종 (이커머스, 식품, 뷰티, 금융 등)
- usageContext (문자열): 어떤 광고주에게 어떤 활용 — 1~2문장
- pitchHook (문자열): 제안서 도입부로 쓸 임팩트 한 줄

JSON 형식으로만 출력. 자연어 설명 금지.`;

const INSIGHT_SCHEMA = {
    type: 'object',
    properties: {
        coreFindings: { type: 'array', items: { type: 'string' } },
        metrics: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                    context: { type: 'string' }
                },
                required: ['label', 'value'],
                additionalProperties: false
            }
        },
        brands: { type: 'array', items: { type: 'string' } },
        platforms: { type: 'array', items: { type: 'string' } },
        audienceSegments: { type: 'array', items: { type: 'string' } },
        industries: { type: 'array', items: { type: 'string' } },
        usageContext: { type: 'string' },
        pitchHook: { type: 'string' }
    },
    required: ['coreFindings', 'metrics', 'brands', 'platforms', 'audienceSegments', 'industries', 'usageContext', 'pitchHook'],
    additionalProperties: false
};

function nowKstIso() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;
}

function loadJson(filePath, fallback) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return fallback; }
}

async function extractOneInsight(client, report, text) {
    const truncated = text.slice(0, TEXT_CHAR_LIMIT);
    const userMessage = `[리포트 제목]\n${report.title}\n\n[발행처]\n${report.publisher}\n\n[발행일]\n${report.date || '미상'}\n\n[본문]\n${truncated}`;

    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
        ],
        messages: [{ role: 'user', content: userMessage }],
        output_config: {
            format: { type: 'json_schema', schema: INSIGHT_SCHEMA }
        }
    });

    let parsed = null;
    for (const block of response.content) {
        if (block.type === 'text') {
            parsed = JSON.parse(block.text);
            break;
        }
    }
    if (parsed && Array.isArray(parsed.coreFindings) && parsed.coreFindings.length > 5) {
        parsed.coreFindings = parsed.coreFindings.slice(0, 5);
    }
    return {
        insight: parsed,
        usage: response.usage,
        stopReason: response.stop_reason
    };
}

async function main() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('FATAL: ANTHROPIC_API_KEY 환경변수가 필요합니다.');
        process.exit(1);
    }
    if (!fs.existsSync(REPORTS_FILE)) {
        console.error('reports.json not found. Run collect-reports first.');
        process.exit(0);
    }

    const client = new Anthropic();
    const reportsData = loadJson(REPORTS_FILE, { reports: [] });
    const candidates = (reportsData.reports || [])
        .filter(r => r.pdfUrl)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, MAX_PDFS);

    console.log(`[insights] candidates: ${candidates.length}`);
    console.log(`[insights] model: ${MODEL}, char limit: ${TEXT_CHAR_LIMIT}`);

    const existing = loadJson(INSIGHTS_FILE, { byUrl: {} });
    const byUrl = existing.byUrl || {};

    let extracted = 0, cached = 0, failed = 0;
    let totalInputTokens = 0, totalOutputTokens = 0, totalCacheRead = 0, totalCacheCreated = 0;

    for (const r of candidates) {
        if (byUrl[r.pdfUrl]?.insight) {
            cached++;
            continue;
        }
        try {
            console.log(`[insights] ${r.title.slice(0, 50)}...`);
            const t0 = Date.now();
            const analysis = await analyzePdf(r.pdfUrl);
            if (!analysis.text || analysis.textLength < 1000) {
                throw new Error(`PDF text too short (${analysis.textLength} chars)`);
            }
            const { insight, usage, stopReason } = await extractOneInsight(client, r, analysis.text);
            const ms = Date.now() - t0;

            byUrl[r.pdfUrl] = {
                title: r.title,
                source: r.source,
                publisher: r.publisher,
                date: r.date,
                pageCount: analysis.pageCount,
                extractedAt: nowKstIso(),
                extractMs: ms,
                stopReason,
                usage: {
                    input_tokens: usage.input_tokens,
                    output_tokens: usage.output_tokens,
                    cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
                    cache_read_input_tokens: usage.cache_read_input_tokens || 0
                },
                insight
            };
            extracted++;
            totalInputTokens += usage.input_tokens || 0;
            totalOutputTokens += usage.output_tokens || 0;
            totalCacheRead += usage.cache_read_input_tokens || 0;
            totalCacheCreated += usage.cache_creation_input_tokens || 0;
            console.log(`  ↳ findings:${insight.coreFindings.length} metrics:${insight.metrics.length} brands:${insight.brands.length} (${ms}ms)`);
        } catch (err) {
            failed++;
            console.error(`  ↳ FAIL: ${err.message}`);
            byUrl[r.pdfUrl] = {
                title: r.title,
                source: r.source,
                publisher: r.publisher,
                date: r.date,
                extractedAt: nowKstIso(),
                error: err.message
            };
        }
    }

    // Prune entries no longer in reports.json
    const validUrls = new Set((reportsData.reports || []).map(r => r.pdfUrl));
    let pruned = 0;
    for (const url of Object.keys(byUrl)) {
        if (!validUrls.has(url)) { delete byUrl[url]; pruned++; }
    }

    // Aggregations across all insights
    const brandCloud = {}, platformCloud = {}, industryCloud = {}, audienceCloud = {};
    for (const entry of Object.values(byUrl)) {
        if (!entry.insight) continue;
        for (const b of entry.insight.brands || []) brandCloud[b] = (brandCloud[b] || 0) + 1;
        for (const p of entry.insight.platforms || []) platformCloud[p] = (platformCloud[p] || 0) + 1;
        for (const i of entry.insight.industries || []) industryCloud[i] = (industryCloud[i] || 0) + 1;
        for (const a of entry.insight.audienceSegments || []) audienceCloud[a] = (audienceCloud[a] || 0) + 1;
    }
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([label, count]) => ({ label, count }));

    // Cost estimate (Haiku 4.5 pricing)
    const costInput = (totalInputTokens / 1_000_000) * 1.00;
    const costOutput = (totalOutputTokens / 1_000_000) * 5.00;
    const costCacheRead = (totalCacheRead / 1_000_000) * 0.10;
    const costCacheCreated = (totalCacheCreated / 1_000_000) * 1.25;
    const totalCost = costInput + costOutput + costCacheRead + costCacheCreated;

    const output = {
        meta: {
            extractedAt: nowKstIso(),
            indexed: Object.keys(byUrl).length,
            extractedThisRun: extracted,
            cachedHits: cached,
            failed,
            pruned,
            model: MODEL,
            usageThisRun: {
                input_tokens: totalInputTokens,
                output_tokens: totalOutputTokens,
                cache_read_input_tokens: totalCacheRead,
                cache_creation_input_tokens: totalCacheCreated,
                estimated_cost_usd: Number(totalCost.toFixed(4))
            }
        },
        topBrands: top(brandCloud),
        topPlatforms: top(platformCloud),
        topIndustries: top(industryCloud),
        topAudiences: top(audienceCloud),
        byUrl
    };

    fs.mkdirSync(path.dirname(INSIGHTS_FILE), { recursive: true });
    fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(output, null, 2));

    console.log('[insights] done.');
    console.log(`  extracted: ${extracted} / cached: ${cached} / failed: ${failed} / pruned: ${pruned}`);
    console.log(`  tokens — in: ${totalInputTokens}, out: ${totalOutputTokens}, cache_read: ${totalCacheRead}, cache_created: ${totalCacheCreated}`);
    console.log(`  estimated cost: $${totalCost.toFixed(4)}`);
    console.log(`  output: ${INSIGHTS_FILE}`);
}

main().catch(err => {
    console.error('[insights] FATAL:', err);
    process.exit(1);
});
