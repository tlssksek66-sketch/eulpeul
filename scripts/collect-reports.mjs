/**
 * 리서치 리포트 수집 — Nasmedia (정기보고서/NPR) 등 매체사 인사이트 수집기.
 * - HTML 스크래핑 (cheerio)
 * - 결과를 assets/data/reports.json 으로 저장
 *
 * 첫 페이지(최근 N건)만 수집하고, 기존 reports.json 과 병합해 누적 보관.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeAllNasmedia } from './scrape-nasmedia.mjs';
import { scrapeCjMezzo } from './scrape-cjmezzo.mjs';
import { scrapeAllIncross } from './scrape-incross.mjs';
import { scrapeDmcReport } from './scrape-dmcreport.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT = process.env.REPORTS_OUTPUT || 'assets/data/reports.json';
const MAX_PAGES = Number(process.env.REPORTS_MAX_PAGES || 2); // 소스별 첫 N 페이지
const RECENT_DAYS = Number(process.env.REPORTS_RECENT_DAYS || 30); // 최근 N일 필터

const SOURCE_META = [
    { key: 'nasmedia-regular', label: '나스리포트 정기보고서', publisher: '케이티 나스미디어',
      url: 'https://www.nasmedia.co.kr/나스리포트/정기보고서/' },
    { key: 'nasmedia-npr',     label: '나스리포트 NPR',         publisher: '케이티 나스미디어',
      url: 'https://www.nasmedia.co.kr/나스리포트/npr/' },
    { key: 'cjmezzo-insight-m', label: 'CJ Mezzo Insight-M',  publisher: 'CJ 메조미디어',
      url: 'https://www.cjmezzomedia.com/insight-m' },
    { key: 'incross-mineport',  label: '인크로스 마인리포트',     publisher: '인크로스',
      url: 'https://www.incross.com/ko/insight/report.asp' },
    { key: 'incross-mineNews',  label: '인크로스 마인카세',       publisher: '인크로스',
      url: 'https://www.incross.com/ko/insight/news.asp' },
    { key: 'dmcreport',         label: 'DMC리포트',             publisher: 'DMC미디어',
      url: 'https://www.dmcreport.co.kr/report' }
];

const CATEGORY_LABELS = {
    // Nasmedia
    'Market': 'Market',
    'Global': 'Global',
    'Case': 'Case',
    'On/Mobile': 'On/Mobile',
    'Digital Broadcast': 'Digital Broadcast',
    'Digital OOH': 'Digital OOH',
    'More': 'More',
    // CJ Mezzo
    '리서치 데이터': '리서치 데이터',
    '마케팅 전략 가이드': '마케팅 전략 가이드',
    '미디어 트렌드': '미디어 트렌드',
    '미디어&마켓': '미디어&마켓',
    '소비 트렌드': '소비 트렌드',
    '시장 트렌드': '시장 트렌드',
    '업종 분석': '업종 분석',
    '캠페인 사례': '캠페인 사례',
    '타겟 분석': '타겟 분석',
    // Incross
    '마인리포트': '마인리포트',
    '마인카세': '마인카세',
    // DMC
    '광고/마케팅': '광고/마케팅',
    '마켓': '마켓',
    '소비자': '소비자',
    'DMC 브리핑': 'DMC 브리핑',
    '뉴스': '뉴스',
    // 공통
    '기타': '기타'
};

const CATEGORY_COLORS = {
    // Nasmedia
    'Market':            '#4a7cff',
    'Global':            '#a78bfa',
    'Case':              '#34d399',
    'On/Mobile':         '#fb923c',
    'Digital Broadcast': '#22d3ee',
    'Digital OOH':       '#fbbf24',
    'More':              '#6b7280',
    // CJ Mezzo
    '리서치 데이터':       '#4a7cff',
    '마케팅 전략 가이드':   '#a78bfa',
    '미디어 트렌드':       '#22d3ee',
    '미디어&마켓':         '#34d399',
    '소비 트렌드':         '#fb923c',
    '시장 트렌드':         '#fbbf24',
    '업종 분석':           '#22d3ee',
    '캠페인 사례':         '#a78bfa',
    '타겟 분석':           '#f87171',
    // Incross
    '마인리포트':          '#4a7cff',
    '마인카세':            '#34d399',
    // DMC
    '광고/마케팅':          '#4a7cff',
    '마켓':                '#fb923c',
    '소비자':              '#fbbf24',
    'DMC 브리핑':          '#a78bfa',
    '뉴스':                '#f87171',
    '기타':              '#5a6079'
};

function nowKstIso() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;
}

function loadExisting(filePath) {
    try {
        if (!fs.existsSync(filePath)) return { reports: [] };
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { reports: Array.isArray(data.reports) ? data.reports : [] };
    } catch {
        return { reports: [] };
    }
}

/**
 * 최근 N일 이내인지 — date 가 "YYYY-MM-DD" 또는 비어있으면 통과
 */
function isRecent(dateStr, days) {
    if (!dateStr) return true; // 날짜 없으면 보존
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return true;
    const reportDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const now = new Date();
    const diffMs = now - reportDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= days;
}

async function main() {
    console.log('[reports] start');
    console.log('[reports] max pages per source:', MAX_PAGES);
    console.log('[reports] recent window (days):', RECENT_DAYS);

    // 1) 모든 소스 병렬 수집
    const [nasmediaResult, cjmezzoResult, incrossResult, dmcResult] = await Promise.allSettled([
        scrapeAllNasmedia({ maxPages: MAX_PAGES }),
        scrapeCjMezzo(),
        scrapeAllIncross(),
        scrapeDmcReport()
    ]);
    const fresh = [];
    if (nasmediaResult.status === 'fulfilled') fresh.push(...nasmediaResult.value);
    else console.error('[reports] nasmedia scrape failed:', nasmediaResult.reason?.message);
    if (cjmezzoResult.status === 'fulfilled') fresh.push(...cjmezzoResult.value);
    else console.error('[reports] cjmezzo scrape failed:', cjmezzoResult.reason?.message);
    if (incrossResult.status === 'fulfilled') fresh.push(...incrossResult.value);
    else console.error('[reports] incross scrape failed:', incrossResult.reason?.message);
    if (dmcResult.status === 'fulfilled') fresh.push(...dmcResult.value);
    else console.error('[reports] dmcreport scrape failed:', dmcResult.reason?.message);
    console.log(`[reports] fresh fetched: ${fresh.length}`);

    // 2) 최근 N일 필터
    const recent = fresh.filter(r => isRecent(r.date, RECENT_DAYS));
    console.log(`[reports] within last ${RECENT_DAYS} days: ${recent.length}`);
    fresh.length = 0;
    fresh.push(...recent);

    // 3) 기존 데이터 로드 + 병합 (URL 기준 dedupe — 신규가 우선, 최근 N일만 유지)
    const outputPath = path.join(REPO_ROOT, OUTPUT);
    const existing = loadExisting(outputPath);
    const byUrl = new Map();
    for (const r of existing.reports) {
        if (r.url && isRecent(r.date, RECENT_DAYS)) byUrl.set(r.url, r);
    }
    let added = 0;
    for (const r of fresh) {
        if (!r.url) continue;
        if (!byUrl.has(r.url)) added++;
        byUrl.set(r.url, r); // 신규로 갱신
    }

    // 4) 정렬 (최신순)
    const merged = [...byUrl.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 4) ID 부여
    const reports = merged.map((r, i) => ({ id: i + 1, ...r }));

    // 5) 통계
    const bySource = {};
    const byCategory = {};
    SOURCE_META.forEach(s => bySource[s.key] = 0);
    reports.forEach(r => {
        bySource[r.source] = (bySource[r.source] || 0) + 1;
        byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    });

    // 6) 메타 빌드
    const output = {
        meta: {
            kind: 'reports',
            title: '리서치 리포트',
            subtitle: '매체사·미디어 에이전시의 정기 인사이트 리포트를 수집·인덱싱',
            collectedAt: nowKstIso(),
            totalReports: reports.length,
            freshCount: added,
            sources: SOURCE_META,
            updatedAt: nowKstIso()
        },
        categories: Object.keys(CATEGORY_LABELS).map(key => ({ key, label: CATEGORY_LABELS[key] })),
        categoryColors: CATEGORY_COLORS,
        bySource,
        byCategory,
        reports
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('[reports] done.');
    console.log(`  total reports: ${reports.length}`);
    console.log(`  newly added:   ${added}`);
    console.log('  by source:', bySource);
    console.log('  by category:', byCategory);
    console.log(`  output:        ${outputPath}`);
}

main().catch(err => {
    console.error('[reports] FATAL:', err);
    process.exit(1);
});
