/**
 * 휴리스틱 분류기 — 감성(positive/neutral/negative) + 카테고리
 * 입력: { title, summary, channel, media, url } → { sentiment, category, score }
 */
import { POSITIVE, NEGATIVE, INTENSIFIERS, NEGATORS, CATEGORY_KEYWORDS, DOMAIN_HINTS } from './lexicon.mjs';

const SENT_TITLE_WEIGHT = 2.0;
const SENT_BODY_WEIGHT = 1.0;
const POSITIVE_THRESHOLD = 1.2;
const NEGATIVE_THRESHOLD = -1.0;

const CAT_TITLE_WEIGHT = 2.0;
const CAT_BODY_WEIGHT = 1.0;
const DOMAIN_BONUS = 1.5;

/**
 * 채널 기본 카테고리 (분류 실패 시 fallback)
 * - news: 내용 기반 분류
 * - blog: 콘텐츠가 강한 신호 줄 때만 다른 카테고리 (review 디폴트)
 * - cafearticle: 항상 community (소비자 반응 지표로만 활용)
 */
const CHANNEL_DEFAULT_CATEGORY = {
    news: 'press',
    blog: 'review',
    cafearticle: 'community'
};

/**
 * 채널별 기본 카테고리 보너스 — 다른 카테고리가 압도적이지 않으면 디폴트가 이김
 */
const CHANNEL_BIAS = {
    blog:        { review: 3.0 },
    cafearticle: { community: 99 } // 카페는 항상 community
};

/**
 * 부정어 매칭용 정규식 — 단어 경계(공백/구두점/시작·끝)로 둘러싸인 경우만 매칭
 * "안정성" 안에 들어있는 "안"은 부정어로 보지 않도록 처리.
 */
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const NEG_RE = new RegExp(
    '(?:^|[\\s.,!?·~()\\[\\]"\'-])(?:' + NEGATORS.map(escapeRe).join('|') + ')(?:[\\s.,!?·~()\\[\\]"\'-]|$)'
);
const INT_RE = new RegExp(
    '(?:^|[\\s.,!?·~()\\[\\]"\'-])(?:' + INTENSIFIERS.map(escapeRe).join('|') + ')(?:[\\s.,!?·~()\\[\\]"\'-]|$)'
);

/**
 * 텍스트에서 감성 점수 산출 — 부정어/강조어 처리
 */
export function scoreSentiment(text) {
    if (!text) return 0;
    const t = text.replace(/\s+/g, ' ');
    let score = 0;

    // 긍정어 매칭 (앞 30자 내 부정어 있으면 반전)
    for (const w of POSITIVE) {
        let idx = 0;
        while ((idx = t.indexOf(w, idx)) !== -1) {
            const ctx = t.slice(Math.max(0, idx - 6), idx);
            const negated = NEG_RE.test(ctx);
            const intensified = INT_RE.test(ctx);
            const weight = (intensified ? 1.5 : 1.0) * (negated ? -1 : 1);
            score += weight;
            idx += w.length;
        }
    }

    // 부정어 매칭
    for (const w of NEGATIVE) {
        let idx = 0;
        while ((idx = t.indexOf(w, idx)) !== -1) {
            const ctx = t.slice(Math.max(0, idx - 6), idx);
            const negated = NEG_RE.test(ctx);
            const intensified = INT_RE.test(ctx);
            const weight = (intensified ? 1.5 : 1.0) * (negated ? -1 : 1);
            score -= weight;
            idx += w.length;
        }
    }

    // 감탄/강한 부정 부호
    if (/[!]{2,}/.test(t)) score += 0.4;
    if (/ㅠㅠ|ㅜㅜ|ㅠㅜ/.test(t)) score -= 0.5;
    if (/ㅋ{2,}|하하|ㅎㅎ/.test(t)) score += 0.3;

    return score;
}

/**
 * 감성 분류 — 제목 가중치 적용
 */
export function classifySentiment({ title = '', summary = '' }) {
    const titleScore = scoreSentiment(title) * SENT_TITLE_WEIGHT;
    const bodyScore = scoreSentiment(summary) * SENT_BODY_WEIGHT;
    const total = titleScore + bodyScore;
    let label = 'neutral';
    if (total >= POSITIVE_THRESHOLD) label = 'positive';
    else if (total <= NEGATIVE_THRESHOLD) label = 'negative';
    return { sentiment: label, sentimentScore: Number(total.toFixed(2)) };
}

/**
 * 카테고리 분류 — 키워드 + 도메인 힌트 + 채널 기본값
 */
export function classifyCategory({ title = '', summary = '', channel = '', media = '', url = '' }) {
    const titleLower = title;
    const bodyLower = summary;
    const scores = {};

    for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
        let s = 0;
        for (const w of words) {
            if (titleLower.includes(w)) s += CAT_TITLE_WEIGHT;
            if (bodyLower.includes(w)) s += CAT_BODY_WEIGHT;
        }
        scores[cat] = s;
    }

    // 도메인 힌트
    const host = extractHost(url) || extractHost(media);
    if (host) {
        for (const [cat, domains] of Object.entries(DOMAIN_HINTS)) {
            if (domains.some(d => host.includes(d))) {
                scores[cat] = (scores[cat] || 0) + DOMAIN_BONUS;
            }
        }
    }

    // 의문문 신호 — 카페 문의글 보정
    if (/[?？]/.test(title) || /[?？]/.test(summary)) {
        scores.community = (scores.community || 0) + 1.0;
    }

    // 채널 디폴트 카테고리 가중 (블로그→review, 카페→community)
    const bias = CHANNEL_BIAS[channel];
    if (bias) {
        for (const [cat, val] of Object.entries(bias)) {
            scores[cat] = (scores[cat] || 0) + val;
        }
    }

    // 최고점 선택. 동률이면 채널 기본값.
    let best = null;
    let bestScore = 0;
    for (const [cat, s] of Object.entries(scores)) {
        if (s > bestScore) { best = cat; bestScore = s; }
    }
    if (!best || bestScore < 1) {
        best = CHANNEL_DEFAULT_CATEGORY[channel] || 'community';
    }
    return { category: best, categoryScore: Number(bestScore.toFixed(2)) };
}

function extractHost(s) {
    if (!s) return '';
    try { return new URL(s).hostname.toLowerCase(); }
    catch { return s.toLowerCase(); }
}

/**
 * 통합 분류
 */
export function classify(item) {
    return { ...classifySentiment(item), ...classifyCategory(item) };
}

/**
 * 키워드 자동 추출 — 본문에서 토픽성 명사 후보 추출 (한국어/영문 둘 다)
 */
const STOP_KEYWORDS = new Set([
    '오늘', '어제', '내일', '이번', '지난', '있다', '없다', '한다', '합니다', '입니다',
    '그리고', '하지만', '그러나', '때문', '경우', '관련', '대한', '우리', '여기', '저기',
    '제품', '사용', '구매', '하는', '하나', '정도', '바로', '바로 그', '모두', '많이', '조금'
]);

export function extractKeywords(text, max = 8) {
    if (!text) return [];
    // 한글 2자 이상 + 영문 단어 추출
    const tokens = (text.match(/[가-힣]{2,}|[A-Za-z][A-Za-z0-9]{2,}/g) || [])
        .filter(t => !STOP_KEYWORDS.has(t));
    const counts = {};
    tokens.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([k]) => k);
}
