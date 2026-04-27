/**
 * 리포트 PDF 토픽 인덱싱 — assets/data/reports.json 의 최신 N건 PDF 분석.
 * - 휴리스틱 (LLM 미사용)
 * - 이미 인덱싱된 PDF 는 캐시로 스킵
 * - 결과를 assets/data/report-index.json 에 저장 (URL → 분석 결과)
 *
 * 환경변수:
 *   INDEX_MAX_PDFS  (기본 10)  — 한 번에 처리할 최대 PDF 수
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzePdf } from './analyze-pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const REPORTS_FILE = path.join(REPO_ROOT, 'assets/data/reports.json');
const INDEX_FILE = path.join(REPO_ROOT, 'assets/data/report-index.json');
const MAX_PDFS = Number(process.env.INDEX_MAX_PDFS || 10);

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

async function main() {
    if (!fs.existsSync(REPORTS_FILE)) {
        console.error('[index] reports.json not found. Run collect-reports first.');
        process.exit(0);
    }
    const reportsData = loadJson(REPORTS_FILE, { reports: [] });
    const reports = (reportsData.reports || [])
        .filter(r => r.pdfUrl)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, MAX_PDFS);

    console.log(`[index] candidates: ${reports.length}`);

    const existing = loadJson(INDEX_FILE, { byUrl: {} });
    const byUrl = existing.byUrl || {};

    let analyzed = 0, cached = 0, failed = 0;
    for (const r of reports) {
        if (byUrl[r.pdfUrl]) {
            cached++;
            continue;
        }
        try {
            console.log(`[index] analyzing: ${r.title.slice(0, 50)}...`);
            const t0 = Date.now();
            const result = await analyzePdf(r.pdfUrl);
            const ms = Date.now() - t0;
            byUrl[r.pdfUrl] = {
                title: r.title,
                source: r.source,
                publisher: r.publisher,
                date: r.date,
                analyzedAt: nowKstIso(),
                analyzeMs: ms,
                ...result
            };
            analyzed++;
            console.log(`  ↳ ${result.pageCount} pages, ${result.outline.length} outline, ${result.headings.length} headings, ${result.keywords.length} keywords (${ms}ms)`);
        } catch (err) {
            failed++;
            console.error(`  ↳ FAIL: ${err.message}`);
            // 실패한 URL 도 기록 (재시도 방지). 다음 실행에 자동 재시도 하려면 entry 안 적기.
            byUrl[r.pdfUrl] = {
                title: r.title,
                source: r.source,
                publisher: r.publisher,
                date: r.date,
                analyzedAt: nowKstIso(),
                error: err.message
            };
        }
    }

    // 30일 지난 항목은 캐시에서 제거 (reports.json 에서 빠진 것들)
    const validUrls = new Set((reportsData.reports || []).map(r => r.pdfUrl));
    let pruned = 0;
    for (const url of Object.keys(byUrl)) {
        if (!validUrls.has(url)) {
            delete byUrl[url];
            pruned++;
        }
    }

    // 토픽 클라우드 — 모든 인덱스의 키워드 빈도 합산
    const topicCloud = {};
    for (const entry of Object.values(byUrl)) {
        if (!entry.keywords) continue;
        for (const { keyword, count } of entry.keywords) {
            topicCloud[keyword] = (topicCloud[keyword] || 0) + count;
        }
    }
    const topicCloudArr = Object.entries(topicCloud)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([keyword, count]) => ({ keyword, count }));

    const output = {
        meta: {
            indexedAt: nowKstIso(),
            indexed: Object.keys(byUrl).length,
            analyzedThisRun: analyzed,
            cachedHits: cached,
            failed,
            pruned,
            maxPdfsPerRun: MAX_PDFS
        },
        topicCloud: topicCloudArr,
        byUrl
    };
    fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(output, null, 2));

    console.log('[index] done.');
    console.log(`  analyzed: ${analyzed} / cached: ${cached} / failed: ${failed} / pruned: ${pruned}`);
    console.log(`  topic cloud size: ${topicCloudArr.length}`);
    console.log(`  output: ${INDEX_FILE}`);
}

main().catch(err => {
    console.error('[index] FATAL:', err);
    process.exit(1);
});
