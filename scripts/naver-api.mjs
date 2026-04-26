/**
 * 네이버 검색 API 클라이언트
 * - news / blog / cafearticle 3종 채널
 * - https://developers.naver.com/docs/serviceapi/search/news/news.md
 *
 * 환경변수:
 *   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 */

const ENDPOINT = 'https://openapi.naver.com/v1/search';

export class NaverSearchClient {
    constructor({ clientId, clientSecret }) {
        if (!clientId || !clientSecret) throw new Error('Naver API credentials missing');
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    async search(channel, query, { display = 20, start = 1, sort = 'date' } = {}) {
        const validChannels = ['news', 'blog', 'cafearticle'];
        if (!validChannels.includes(channel)) {
            throw new Error(`Invalid channel: ${channel}`);
        }
        const url = new URL(`${ENDPOINT}/${channel}.json`);
        url.searchParams.set('query', query);
        url.searchParams.set('display', String(Math.min(100, Math.max(1, display))));
        url.searchParams.set('start', String(Math.min(1000, Math.max(1, start))));
        url.searchParams.set('sort', sort);

        const res = await fetch(url, {
            headers: {
                'X-Naver-Client-Id': this.clientId,
                'X-Naver-Client-Secret': this.clientSecret
            }
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Naver ${channel} ${res.status}: ${body.slice(0, 200)}`);
        }
        return res.json();
    }
}

/**
 * Naver API 응답 → 우리 클리핑 스키마로 정규화
 */
export function normalizeItem(raw, channel) {
    const stripTags = (s) => (s || '')
        .replace(/<\/?b>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const title = stripTags(raw.title);
    const summary = stripTags(raw.description);
    const url = raw.originallink || raw.link || '';

    let media = '';
    let date = '';
    if (channel === 'news') {
        media = extractMediaFromUrl(url) || extractMediaFromUrl(raw.link) || '뉴스';
        date = formatNewsDate(raw.pubDate);
    } else if (channel === 'blog') {
        media = `네이버 블로그 · ${stripTags(raw.bloggername || '')}`.replace(/ · $/, '');
        date = formatBlogDate(raw.postdate);
    } else if (channel === 'cafearticle') {
        media = `네이버 카페 · ${stripTags(raw.cafename || '')}`.replace(/ · $/, '');
        date = ''; // 카페 응답에는 작성일이 없음 — 수집 시각으로 fallback (collect.mjs에서 처리)
    }

    return { channel, title, summary, url, media, date };
}

/**
 * news API의 pubDate (RFC 822) → "YYYY-MM-DD HH:mm" (KST)
 */
function formatNewsDate(pubDate) {
    if (!pubDate) return '';
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return '';
    // KST (UTC+9)로 변환
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const mi = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/**
 * blog API의 postdate ("YYYYMMDD") → "YYYY-MM-DD"
 */
function formatBlogDate(s) {
    if (!s || s.length !== 8) return '';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * URL에서 매체명 추출 (도메인 → 한글 매체명 매핑 + fallback)
 */
const MEDIA_MAP = {
    'etnews.com': '전자신문',
    'zdnet.co.kr': 'ZDNET 코리아',
    'mt.co.kr': '머니투데이',
    'mk.co.kr': '매일경제',
    'hankyung.com': '한국경제',
    'edaily.co.kr': '이데일리',
    'fnnews.com': '파이낸셜뉴스',
    'dt.co.kr': '디지털타임스',
    'sedaily.com': '서울경제',
    'asiae.co.kr': '아시아경제',
    'newsis.com': '뉴시스',
    'yna.co.kr': '연합뉴스',
    'yonhapnews.co.kr': '연합뉴스',
    'chosun.com': '조선일보',
    'sports.chosun.com': '스포츠조선',
    'donga.com': '동아일보',
    'sports.donga.com': '스포츠동아',
    'hani.co.kr': '한겨레',
    'khan.co.kr': '경향신문',
    'joongang.co.kr': '중앙일보',
    'heraldcorp.com': '헤럴드경제',
    'biz.heraldcorp.com': '헤럴드경제',
    'itdonga.com': 'IT동아',
    'cetizen.com': '세티즌',
    'ddaily.co.kr': '디지털데일리',
    'businesspost.co.kr': '비즈니스포스트',
    'bloter.net': '블로터',
    'osen.mt.co.kr': 'OSEN',
    'mydaily.co.kr': '마이데일리',
    'spotvnews.co.kr': '스포티비뉴스',
    'isplus.com': '일간스포츠',
    'kbench.com': '케이벤치',
    'electimes.com': '전기신문'
};

export function extractMediaFromUrl(url) {
    if (!url) return '';
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        if (MEDIA_MAP[host]) return MEDIA_MAP[host];
        // 서브도메인 매칭
        for (const [k, v] of Object.entries(MEDIA_MAP)) {
            if (host.endsWith(k)) return v;
        }
        return host.split('.').slice(0, -1).join('.') || host;
    } catch {
        return '';
    }
}
