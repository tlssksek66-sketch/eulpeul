/**
 * SHOKZ 매거진 일일 수집기
 * - 4개 키워드 × 3채널(news/blog/cafearticle) Naver Search API 호출
 * - URL dedupe + 키워드 정확도 필터
 * - 채널별 quota=20 제한
 * - 휴리스틱 분류 (sentiment + category) + 키워드 자동 추출
 * - assets/data/clippings.json 으로 저장
 *
 * 환경변수:
 *   NAVER_CLIENT_ID
 *   NAVER_CLIENT_SECRET
 *   COLLECT_KEYWORDS  (선택, comma-separated. 기본: SHOKZ,샥즈,샥즈코리아,SHOKZ KOREA)
 *   COLLECT_QUOTA     (선택, 채널당 max 결과수. 기본: 20)
 *   COLLECT_OUTPUT    (선택, 출력 경로. 기본: assets/data/clippings.json)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NaverSearchClient, normalizeItem } from './naver-api.mjs';
import { classify, extractKeywords } from './classifier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const KEYWORDS = (process.env.COLLECT_KEYWORDS || 'SHOKZ,샥즈,샥즈코리아,SHOKZ KOREA')
    .split(',').map(s => s.trim()).filter(Boolean);
const QUOTA = Number(process.env.COLLECT_QUOTA || 20);
const OUTPUT = process.env.COLLECT_OUTPUT || 'assets/data/clippings.json';
const CHANNELS = ['news', 'blog', 'cafearticle'];

// 정확도 필터: 제목/요약에 브랜드 키워드 중 하나가 반드시 포함
const BRAND_PATTERNS = [
    /샥즈/i, /SHOKZ/i, /shokz/i
];

function isAboutShokz(title, summary) {
    const text = `${title} ${summary}`;
    return BRAND_PATTERNS.some(p => p.test(text));
}

function nowKstIso() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;
}

function nowKstDate() {
    return nowKstIso().slice(0, 10);
}

async function main() {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.error('FATAL: NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 필요합니다.');
        process.exit(1);
    }
    const client = new NaverSearchClient({ clientId, clientSecret });

    console.log('[collect] keywords:', KEYWORDS);
    console.log('[collect] quota per channel:', QUOTA);

    const dedup = new Map(); // url → item
    const stats = { total: 0, kept: 0, dropped: 0, byChannel: {} };
    CHANNELS.forEach(ch => { stats.byChannel[ch] = { collected: 0, raw: 0 }; });

    for (const channel of CHANNELS) {
        for (const keyword of KEYWORDS) {
            try {
                const data = await client.search(channel, keyword, { display: 30, sort: 'date' });
                const items = (data.items || []).map(raw => normalizeItem(raw, channel));
                stats.total += items.length;
                stats.byChannel[channel].raw += items.length;

                for (const it of items) {
                    if (!it.url) { stats.dropped++; continue; }
                    if (!isAboutShokz(it.title, it.summary)) { stats.dropped++; continue; }
                    const key = canonicalUrl(it.url);
                    if (dedup.has(key)) continue; // 키워드 간 중복 제거
                    if (!it.date) it.date = nowKstDate(); // 카페는 날짜 없음 → 수집일로 fallback
                    dedup.set(key, it);
                }
            } catch (err) {
                console.error(`[collect] ${channel} × "${keyword}" failed:`, err.message);
            }
        }
    }

    // 채널별 quota 적용 (최신 날짜 우선)
    const finalItems = [];
    for (const channel of CHANNELS) {
        const chItems = [...dedup.values()]
            .filter(it => it.channel === channel)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, QUOTA);
        stats.byChannel[channel].collected = chItems.length;
        finalItems.push(...chItems);
    }
    stats.kept = finalItems.length;
    stats.dropped = stats.total - finalItems.length;

    // 분류 + 태그 추출 + ID 부여
    const enriched = finalItems.map((it, i) => {
        const cls = classify(it);
        const tags = extractKeywords(`${it.title} ${it.summary}`, 8);
        return {
            id: i + 1,
            channel: it.channel,
            media: it.media,
            category: cls.category,
            sentiment: cls.sentiment,
            title: it.title,
            summary: it.summary,
            date: it.date,
            url: it.url,
            tags
        };
    });

    // 메타 빌드
    const channelsMeta = CHANNELS.map(key => {
        const conf = {
            news:        { label: '뉴스',   color: '#4a7cff' },
            blog:        { label: '블로그', color: '#34d399' },
            cafearticle: { label: '카페',   color: '#fb923c' }
        }[key];
        return { key, ...conf, collected: stats.byChannel[key].collected, quota: QUOTA };
    });

    const output = {
        meta: {
            brand: 'SHOKZ',
            region: 'KOREA',
            kind: 'shokz',
            title: '샥즈 코리아 매거진',
            subtitle: '웹 상의 모든 샥즈 관련 뉴스·기사·콘텐츠를 한 화면에서 모니터링',
            searchKeyword: KEYWORDS.join(', '),
            collectedAt: nowKstIso(),
            totalClippings: enriched.length,
            filterPassed: enriched.length,
            noiseFiltered: stats.dropped,
            accuracyFilter: true
        },
        channels: channelsMeta,
        categories: [
            { key: 'all',       label: '전체' },
            { key: 'product',   label: '신제품' },
            { key: 'review',    label: '리뷰' },
            { key: 'tech',      label: '기술' },
            { key: 'sports',    label: '스포츠' },
            { key: 'marketing', label: '마케팅' },
            { key: 'press',     label: '보도/IR' },
            { key: 'community', label: '커뮤니티' }
        ],
        categoryColors: {
            product: '#4a7cff', review: '#34d399', tech: '#22d3ee',
            sports: '#fbbf24', marketing: '#a78bfa', press: '#f87171', community: '#fb923c'
        },
        clippings: enriched
    };

    const outputPath = path.join(REPO_ROOT, OUTPUT);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('[collect] done.');
    console.log(`  total raw: ${stats.total}`);
    console.log(`  kept:      ${stats.kept}`);
    console.log(`  dropped:   ${stats.dropped}`);
    CHANNELS.forEach(ch => {
        console.log(`  ${ch}: collected=${stats.byChannel[ch].collected} (raw=${stats.byChannel[ch].raw})`);
    });
    console.log(`  output:    ${outputPath}`);
}

function canonicalUrl(url) {
    try {
        const u = new URL(url);
        u.hash = '';
        // 추적 파라미터 제거
        ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k => u.searchParams.delete(k));
        return u.toString();
    } catch {
        return url;
    }
}

main().catch(err => {
    console.error('[collect] FATAL:', err);
    process.exit(1);
});
