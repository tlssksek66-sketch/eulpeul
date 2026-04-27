/**
 * 이커머스/광고 매거진 분류기
 * - 카테고리 분류: ads / shopping / policy / trend / dispute / corp
 * - 감성 분석은 base classifier 재사용
 * - 노이즈 필터: 이커머스 무관 콘텐츠 드롭
 * - 관련성 검증: 플랫폼·광고 키워드 1개 이상 필요
 */
import { scoreSentiment, classifySentiment, extractKeywords } from './classifier.mjs';
import {
    COMMERCE_CATEGORIES,
    COMMERCE_DOMAIN_HINTS,
    COMMERCE_CHANNEL_DEFAULT,
    COMMERCE_NOISE,
    COMMERCE_RELEVANCE
} from './lexicon-commerce.mjs';

export { COMMERCE_CATEGORIES };

const CAT_TITLE_WEIGHT = 2.0;
const CAT_BODY_WEIGHT = 1.0;
const DOMAIN_BONUS = 1.5;

/**
 * 이커머스 관련성 검증 — 플랫폼/광고 키워드 + 카테고리 단어 동시 보유 필요
 */
export function isCommerceRelevant(item) {
    const text = `${item.title || ''} ${item.summary || ''}`;
    // 1. 플랫폼/브랜드 키워드 (네이버/쿠팡 등)
    if (!COMMERCE_RELEVANCE.some(w => text.includes(w))) return false;
    // 2. 명백한 노이즈 (스포츠/연예/게임)
    const noiseHits = COMMERCE_NOISE.filter(w => text.includes(w)).length;
    if (noiseHits >= 1) return false;
    // 3. 이커머스 카테고리 단어 1개 이상 — "네이버" 단독 언급은 드롭
    const hasCategoryWord = Object.values(COMMERCE_CATEGORIES).some(words =>
        words.some(w => text.includes(w))
    );
    if (!hasCategoryWord) return false;
    return true;
}

/**
 * 카테고리 분류 — 이커머스 카테고리 셋 사용
 */
export function classifyCommerceCategory({ title = '', summary = '', channel = '', media = '', url = '' }) {
    const scores = {};
    for (const [cat, words] of Object.entries(COMMERCE_CATEGORIES)) {
        let s = 0;
        for (const w of words) {
            if (title.includes(w)) s += CAT_TITLE_WEIGHT;
            if (summary.includes(w)) s += CAT_BODY_WEIGHT;
        }
        scores[cat] = s;
    }

    // 도메인 힌트
    const host = extractHost(url) || extractHost(media);
    if (host) {
        for (const [cat, domains] of Object.entries(COMMERCE_DOMAIN_HINTS)) {
            if (domains.some(d => host.includes(d))) {
                scores[cat] = (scores[cat] || 0) + DOMAIN_BONUS;
            }
        }
    }

    // 광고 카테고리는 신뢰도 가중 (사용자 우선순위 1순위)
    if ((scores.ads || 0) > 0) scores.ads += 0.5;

    // 최고점 선택
    let best = null;
    let bestScore = 0;
    for (const [cat, s] of Object.entries(scores)) {
        if (s > bestScore) { best = cat; bestScore = s; }
    }
    if (!best || bestScore < 1) {
        best = COMMERCE_CHANNEL_DEFAULT[channel] || 'trend';
    }
    return { category: best, categoryScore: Number(bestScore.toFixed(2)) };
}

function extractHost(s) {
    if (!s) return '';
    try { return new URL(s).hostname.toLowerCase(); }
    catch { return s.toLowerCase(); }
}

/**
 * 통합 분류 — 카테고리 + 감성 + 키워드 추출
 */
export function classifyCommerce(item) {
    const cat = classifyCommerceCategory(item);
    const sent = classifySentiment({ title: item.title, summary: item.summary });
    return { ...cat, ...sent };
}

export { extractKeywords, scoreSentiment };
