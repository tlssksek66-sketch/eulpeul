/**
 * MCP Core — KB 로딩 + 시맨틱 검색 + 광고주 매칭 (순수 함수)
 *
 * 양 surface (stdio / Cloudflare Worker) 가 공유.
 * 데이터 소스는 KBLoader 인터페이스로 추상화:
 *   - LocalKBLoader: 로컬 파일시스템 (stdio)
 *   - HttpKBLoader: GitHub Pages URL fetch (Worker)
 *
 * 모든 함수는 dataKB 객체를 인자로 받음 — 부수효과 없음.
 */

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBED_MODEL = 'voyage-3.5-lite';

/* ---------- KB Shape ---------- */
// kb = { insights, roadmap, embeddings, neighbors }

export function listCards(kb) {
    return Object.entries(kb.insights?.byUrl || {})
        .filter(([, v]) => v.insight)
        .map(([url, v]) => ({ url, ...v }));
}

export function getCardByUrl(kb, url) {
    const v = kb.insights?.byUrl?.[url];
    if (!v?.insight) return null;
    return { url, ...v };
}

/* ---------- Voyage 임베딩 ---------- */
export async function embedQuery(query, voyageApiKey) {
    if (!voyageApiKey) throw new Error('VOYAGE_API_KEY required for live query embedding');
    const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${voyageApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: [query], model: EMBED_MODEL, input_type: 'query' })
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Voyage ${res.status}: ${body}`);
    }
    const data = await res.json();
    return data.data?.[0]?.embedding;
}

/* ---------- 코사인 유사도 ---------- */
export function cosine(a, b) {
    if (!a || !b) return 0;
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

/* ---------- 시맨틱 검색 ---------- */
export async function searchInsights(kb, { query, k = 5, voyageApiKey }) {
    const cards = listCards(kb);
    if (cards.length === 0) return { hits: [], note: 'KB empty' };

    const queryVec = await embedQuery(query, voyageApiKey);
    if (!queryVec) return { hits: [], note: 'embedding failed' };

    const scored = [];
    for (const c of cards) {
        const cardVec = kb.embeddings?.byUrl?.[c.url]?.embedding;
        if (!cardVec) continue;
        scored.push({
            url: c.url,
            score: Number(cosine(queryVec, cardVec).toFixed(4)),
            title: c.title,
            publisher: c.publisher,
            date: c.date,
            pageCount: c.pageCount,
            pitchHook: c.insight?.pitchHook,
            coreFindings: c.insight?.coreFindings || [],
            metrics: c.insight?.metrics || [],
            brands: c.insight?.brands || [],
            platforms: c.insight?.platforms || [],
            industries: c.insight?.industries || [],
            audienceSegments: c.insight?.audienceSegments || [],
            usageContext: c.insight?.usageContext
        });
    }
    scored.sort((a, b) => b.score - a.score);
    return { hits: scored.slice(0, k), totalCards: cards.length };
}

/* ---------- 광고주 매칭 ---------- */
export async function matchAdvertiser(kb, { industry, audience, query, k = 3, voyageApiKey }) {
    const cards = listCards(kb);
    if (cards.length === 0) return { hits: [], plays: [], note: 'KB empty' };

    // 1) 산업·오디언스 부분 일치 필터
    const industryLc = (industry || '').toLowerCase();
    const audienceLc = (audience || '').toLowerCase();
    const filtered = cards.filter(c => {
        const ins = c.insight || {};
        const indMatch = !industryLc || (ins.industries || []).some(i => i.toLowerCase().includes(industryLc));
        const audMatch = !audienceLc || (ins.audienceSegments || []).some(a => a.toLowerCase().includes(audienceLc));
        return indMatch && audMatch;
    });
    const pool = filtered.length > 0 ? filtered : cards; // fallback: 전체

    // 2) 임베딩 검색 (query 가 있을 때만)
    let scored = pool.map(c => ({ card: c, score: 0 }));
    if (query) {
        const queryParts = [query, industry, audience].filter(Boolean).join(' / ');
        const queryVec = await embedQuery(queryParts, voyageApiKey);
        if (queryVec) {
            scored = pool.map(c => ({
                card: c,
                score: Number(cosine(queryVec, kb.embeddings?.byUrl?.[c.url]?.embedding).toFixed(4))
            }));
        }
    }
    scored.sort((a, b) => b.score - a.score);
    const topCards = scored.slice(0, k).map(({ card, score }) => ({
        url: card.url,
        score,
        title: card.title,
        publisher: card.publisher,
        date: card.date,
        pitchHook: card.insight?.pitchHook,
        coreFindings: card.insight?.coreFindings || [],
        metrics: (card.insight?.metrics || []).slice(0, 3),
        industries: card.insight?.industries || [],
        audienceSegments: card.insight?.audienceSegments || [],
        usageContext: card.insight?.usageContext
    }));

    // 3) 매칭 SA/GFA 플레이 (산업·오디언스 일치)
    const allPlays = [
        ...(kb.roadmap?.saPlays || []).map(p => ({ ...p, kind: 'SA' })),
        ...(kb.roadmap?.gfaPlays || []).map(p => ({ ...p, kind: 'GFA' }))
    ];
    const playMatches = allPlays.filter(p => {
        const indMatch = !industryLc || (p.targetIndustries || []).some(i => i.toLowerCase().includes(industryLc));
        const audMatch = !audienceLc || (p.targetAudiences || []).some(a => a.toLowerCase().includes(audienceLc));
        return indMatch && audMatch;
    });

    return {
        hits: topCards,
        plays: playMatches,
        meta: {
            poolSize: pool.length,
            filteredByIndustryAudience: filtered.length,
            queriedSemantic: Boolean(query)
        }
    };
}

/* ---------- 메타 리스트 ---------- */
export function listMeta(kb, kind) {
    const map = {
        industry: kb.insights?.topIndustries,
        brand: kb.insights?.topBrands,
        platform: kb.insights?.topPlatforms,
        audience: kb.insights?.topAudiences
    };
    return (map[kind] || []).map(({ label, count }) => ({ label, count }));
}

export function getRoadmap(kb) {
    return {
        summary: kb.roadmap?.summary || '',
        audiencePillars: kb.roadmap?.audiencePillars || [],
        saPlays: kb.roadmap?.saPlays || [],
        gfaPlays: kb.roadmap?.gfaPlays || [],
        caveats: kb.roadmap?.caveats || [],
        builtAt: kb.roadmap?.meta?.builtAt
    };
}

export function getNeighbors(kb, url, k = 5) {
    const list = kb.neighbors?.byUrl?.[url] || [];
    return list.slice(0, k);
}
