/**
 * Phase 2 — Build-time semantic clustering (Voyage AI 임베딩)
 *
 * 입력: assets/data/insights.json (인사이트 카드)
 * 출력:
 *   - assets/data/embeddings.json  : 카드별 임베딩 + 텍스트 해시 (빌드 캐시용, 프론트는 안 읽음)
 *   - assets/data/neighbors.json   : 카드 URL → Top-K 유사 카드 (프론트 렌더용, 작음)
 *
 * 캐시 전략: 임베딩 텍스트의 SHA1 해시가 같으면 API 재호출 스킵
 *   → 인사이트 변동 없는 한 비용 0
 *
 * 모델: voyage-3.5-lite ($0.02 / 1M tokens, 한국어 멀티링구얼)
 *   - 카드당 ~500 토큰 → 10 카드 = $0.0001
 *
 * 환경변수:
 *   VOYAGE_API_KEY  (필수)
 *   EMBED_FORCE     ('1' 시 캐시 무시 강제 재생성)
 *   NEIGHBOR_K      (기본 5)
 */
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const INSIGHTS_FILE = path.join(REPO_ROOT, 'assets/data/insights.json');
const EMBEDDINGS_FILE = path.join(REPO_ROOT, 'assets/data/embeddings.json');
const NEIGHBORS_FILE = path.join(REPO_ROOT, 'assets/data/neighbors.json');

const MODEL = 'voyage-3.5-lite';
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const NEIGHBOR_K = Number(process.env.NEIGHBOR_K || 5);

function nowKstIso() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;
}

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }

function buildEmbedText(card) {
    const ins = card.insight || {};
    return [
        card.title || '',
        ins.pitchHook || '',
        (ins.coreFindings || []).join(' '),
        '브랜드: ' + (ins.brands || []).join(', '),
        '플랫폼: ' + (ins.platforms || []).join(', '),
        '오디언스: ' + (ins.audienceSegments || []).join(', '),
        '산업: ' + (ins.industries || []).join(', '),
        '활용: ' + (ins.usageContext || '')
    ].filter(s => s && !s.endsWith(': ')).join('\n');
}

async function embedBatch(texts) {
    const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: texts,
            model: MODEL,
            input_type: 'document'
        })
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Voyage ${res.status}: ${body}`);
    }
    const data = await res.json();
    return {
        embeddings: data.data.sort((a, b) => a.index - b.index).map(d => d.embedding),
        usage: data.usage || {}
    };
}

function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}

async function main() {
    if (!process.env.VOYAGE_API_KEY) {
        console.error('FATAL: VOYAGE_API_KEY 가 필요합니다.');
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

    const existing = loadJson(EMBEDDINGS_FILE, { byUrl: {} });
    const byUrl = existing.byUrl || {};
    const force = process.env.EMBED_FORCE === '1';

    // 새로 임베딩해야 할 카드 (신규 + 텍스트 변경)
    const todo = [];
    const texts = [];
    for (const c of cards) {
        const text = buildEmbedText(c);
        const textHash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
        if (!force && byUrl[c.url]?.textHash === textHash && byUrl[c.url]?.embedding) {
            continue;
        }
        todo.push({ url: c.url, textHash, text });
        texts.push(text);
    }

    let totalTokens = 0;
    let embedMs = 0;
    if (todo.length > 0) {
        console.log(`[embeddings] embedding ${todo.length} new/changed cards (force=${force})...`);
        const t0 = Date.now();
        const { embeddings, usage } = await embedBatch(texts);
        embedMs = Date.now() - t0;
        for (let i = 0; i < todo.length; i++) {
            byUrl[todo[i].url] = {
                textHash: todo[i].textHash,
                textPreview: todo[i].text.slice(0, 240),
                embedding: embeddings[i],
                embeddedAt: nowKstIso()
            };
        }
        totalTokens = usage.total_tokens || 0;
        console.log(`  ↳ ${embedMs}ms, tokens: ${totalTokens}`);
    } else {
        console.log('[embeddings] all cards up to date — skip API call.');
    }

    // 인사이트에 없는 entry 정리
    const validUrls = new Set(cards.map(c => c.url));
    let pruned = 0;
    for (const u of Object.keys(byUrl)) {
        if (!validUrls.has(u)) { delete byUrl[u]; pruned++; }
    }

    // 모든 카드에 대해 neighbor 재계산 (저렴)
    const cardMeta = new Map(cards.map(c => [c.url, c]));
    const neighborByUrl = {};
    for (const c of cards) {
        const a = byUrl[c.url]?.embedding;
        if (!a) continue;
        const scored = [];
        for (const c2 of cards) {
            if (c2.url === c.url) continue;
            const b = byUrl[c2.url]?.embedding;
            if (!b) continue;
            scored.push({ url: c2.url, score: cosine(a, b) });
        }
        scored.sort((x, y) => y.score - x.score);
        neighborByUrl[c.url] = scored.slice(0, NEIGHBOR_K).map(s => {
            const meta = cardMeta.get(s.url);
            return {
                url: s.url,
                score: Number(s.score.toFixed(4)),
                title: meta?.title || '',
                publisher: meta?.publisher || '',
                date: meta?.date || ''
            };
        });
    }

    const dimensions = cards.length > 0 ? (byUrl[cards[0].url]?.embedding?.length || 0) : 0;
    const cost = totalTokens / 1_000_000 * 0.02;

    const embeddingsOut = {
        meta: {
            builtAt: nowKstIso(),
            model: MODEL,
            dimensions,
            cardsCount: cards.length,
            embeddedThisRun: todo.length,
            pruned,
            usage: {
                total_tokens: totalTokens,
                estimated_cost_usd: Number(cost.toFixed(6))
            }
        },
        byUrl
    };
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddingsOut, null, 2));

    const neighborsOut = {
        meta: {
            builtAt: nowKstIso(),
            model: MODEL,
            cardsCount: cards.length,
            neighborK: NEIGHBOR_K
        },
        byUrl: neighborByUrl
    };
    fs.writeFileSync(NEIGHBORS_FILE, JSON.stringify(neighborsOut, null, 2));

    console.log('[embeddings] done.');
    console.log(`  cards: ${cards.length}, embedded this run: ${todo.length}, pruned: ${pruned}`);
    console.log(`  cost: $${cost.toFixed(4)}, dimensions: ${dimensions}`);
    console.log(`  outputs: ${EMBEDDINGS_FILE}, ${NEIGHBORS_FILE}`);
}

main().catch(err => {
    console.error('[embeddings] FATAL:', err);
    process.exit(1);
});
