/**
 * 플랫폼·이커머스 동향 일일 수집기
 * - 14~16개 키워드 × 뉴스 채널 = 병렬 수집 (Promise.all)
 * - URL dedupe + 이커머스 관련성 필터(엄격)
 * - 카테고리 분류 (ads/shopping/policy/trend/dispute/corp) + 감성
 * - assets/data/commerce.json 으로 저장
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NaverSearchClient, normalizeItem } from './naver-api.mjs';
import { classifyCommerce, isCommerceRelevant, extractKeywords } from './classifier-commerce.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// 시드 키워드 — 플랫폼·광고·커머스 14개
const KEYWORDS = (process.env.COMMERCE_KEYWORDS || [
    '네이버 쇼핑',
    '스마트스토어',
    '라이브커머스',
    '쇼핑라이브',
    '네이버 광고',
    '쇼핑검색광고',
    '검색광고',
    '파워컨텐츠',
    'ADVoost',
    '부스트업 캠페인',
    '네이버페이',
    '네이버플러스',
    '브랜드스토어',
    '이커머스 트렌드'
].join(',')).split(',').map(s => s.trim()).filter(Boolean);

const QUOTA = Number(process.env.COMMERCE_QUOTA || 50);
const PER_KEYWORD = Number(process.env.COMMERCE_PER_KEYWORD || 15);
const OUTPUT = process.env.COMMERCE_OUTPUT || 'assets/data/commerce.json';
const CHANNEL = 'news'; // 뉴스 채널만 사용

const CATEGORIES_META = [
    { key: 'all',      label: '전체' },
    { key: 'ads',      label: '광고·마케팅' },
    { key: 'shopping', label: '쇼핑·커머스' },
    { key: 'policy',   label: '정책·기능' },
    { key: 'trend',    label: '트렌드·분석' },
    { key: 'dispute',  label: '분쟁·제재' },
    { key: 'corp',     label: '기업·M&A' }
];

const CATEGORY_COLORS = {
    ads:      '#4a7cff',
    shopping: '#fb923c',
    policy:   '#22d3ee',
    trend:    '#34d399',
    dispute:  '#f87171',
    corp:     '#a78bfa'
};

function nowKstIso() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;
}

function canonicalUrl(url) {
    try {
        const u = new URL(url);
        u.hash = '';
        ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k => u.searchParams.delete(k));
        return u.toString();
    } catch { return url; }
}

async function main() {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.error('FATAL: NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 필요합니다.');
        process.exit(1);
    }
    const client = new NaverSearchClient({ clientId, clientSecret });

    console.log('[commerce] keywords:', KEYWORDS.length);
    console.log('[commerce] per-keyword:', PER_KEYWORD, '/ quota:', QUOTA);

    // 병렬 수집
    const results = await Promise.allSettled(
        KEYWORDS.map(kw => client.search(CHANNEL, kw, { display: PER_KEYWORD, sort: 'date' }))
    );

    let raw = 0;
    const byUrl = new Map();
    const byKeyword = {};
    results.forEach((r, i) => {
        const kw = KEYWORDS[i];
        byKeyword[kw] = { raw: 0, kept: 0 };
        if (r.status !== 'fulfilled') {
            console.error(`[commerce] "${kw}" failed:`, r.reason && r.reason.message);
            return;
        }
        const items = (r.value.items || []).map(it => normalizeItem(it, CHANNEL));
        byKeyword[kw].raw = items.length;
        raw += items.length;
        for (const it of items) {
            if (!it.url) continue;
            if (!isCommerceRelevant(it)) continue;
            const key = canonicalUrl(it.url);
            if (byUrl.has(key)) continue;
            byUrl.set(key, { ...it, keyword: kw });
            byKeyword[kw].kept++;
        }
    });

    // 최신순 정렬 + quota
    const finalItems = [...byUrl.values()]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, QUOTA);

    // 분류 + 태그
    const enriched = finalItems.map((it, i) => {
        const r = classifyCommerce(it);
        const tags = extractKeywords(`${it.title} ${it.summary}`, 8);
        return {
            id: i + 1,
            channel: it.channel,
            media: it.media,
            category: r.category,
            sentiment: r.sentiment,
            sentimentScore: r.sentimentScore,
            title: it.title,
            summary: it.summary,
            date: it.date,
            url: it.url,
            tags,
            sourceKeyword: it.keyword
        };
    });

    // 키워드별 통계 (인덱싱 결과)
    const indexByKeyword = KEYWORDS.map(kw => ({
        keyword: kw,
        raw: byKeyword[kw]?.raw || 0,
        kept: byKeyword[kw]?.kept || 0
    }));

    const output = {
        meta: {
            kind: 'commerce',
            title: '플랫폼·이커머스 동향',
            subtitle: '네이버·쿠팡 등 플랫폼 비즈니스 콘텐츠를 매일 자동 수집',
            collectedAt: nowKstIso(),
            totalClippings: enriched.length,
            filterPassed: enriched.length,
            noiseFiltered: raw - enriched.length,
            keywords: KEYWORDS,
            accuracyFilter: true
        },
        channels: [
            { key: 'news', label: '뉴스', color: '#4a7cff', collected: enriched.length, quota: QUOTA }
        ],
        categories: CATEGORIES_META,
        categoryColors: CATEGORY_COLORS,
        indexByKeyword,
        clippings: enriched
    };

    const outputPath = path.join(REPO_ROOT, OUTPUT);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('[commerce] done.');
    console.log(`  raw:    ${raw}`);
    console.log(`  kept:   ${enriched.length}`);
    console.log(`  output: ${outputPath}`);
    indexByKeyword.forEach(k => console.log(`  · ${k.keyword.padEnd(16)} raw=${k.raw} kept=${k.kept}`));
}

main().catch(err => {
    console.error('[commerce] FATAL:', err);
    process.exit(1);
});
