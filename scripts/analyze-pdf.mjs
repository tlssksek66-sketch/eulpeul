/**
 * PDF 휴리스틱 분석기 — LLM 없이 토픽 인덱스 추출
 * - 목차/북마크 (PDF outline)
 * - 페이지 수
 * - 본문 텍스트 (정제 후)
 * - 헤딩 후보 (큰 폰트 사이즈 기준)
 * - 한국어 키워드 빈도 Top N
 *
 * pdfjs-dist 5.x ESM 사용.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const UA = 'Mozilla/5.0 (compatible; magazine-bot/1.0; +https://github.com/tlssksek66-sketch/eulpeul)';

// 워커 비활성 (Node.js 환경)
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * URL 에서 PDF 다운로드 → ArrayBuffer
 */
async function fetchPdfBuffer(url, { maxBytes = 30 * 1024 * 1024 } = {}) {
    const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'application/pdf,*/*' },
        redirect: 'follow'
    });
    if (!res.ok) throw new Error(`PDF fetch ${res.status}: ${url}`);
    const lengthHeader = res.headers.get('content-length');
    if (lengthHeader && Number(lengthHeader) > maxBytes) {
        throw new Error(`PDF too large (${lengthHeader} bytes)`);
    }
    return await res.arrayBuffer();
}

/**
 * outline 트리 → 평탄화된 toc 배열로 변환
 */
function flattenOutline(items, depth = 0) {
    if (!items || items.length === 0) return [];
    const flat = [];
    for (const it of items) {
        flat.push({ depth, title: (it.title || '').trim() });
        if (it.items && it.items.length > 0) {
            flat.push(...flattenOutline(it.items, depth + 1));
        }
    }
    return flat;
}

/**
 * 페이지 텍스트 추출 + 헤딩 후보 (폰트 크기 기준)
 */
async function extractPageContent(page) {
    const content = await page.getTextContent();
    let pageText = '';
    const fontSizes = new Map();
    const items = [];
    for (const it of content.items) {
        const str = (it.str || '').trim();
        if (!str) continue;
        // pdfjs transform[3] 이 폰트 높이
        const size = Math.round(Math.abs(it.transform?.[3] || 0) * 10) / 10;
        items.push({ str, size });
        fontSizes.set(size, (fontSizes.get(size) || 0) + 1);
        pageText += str + ' ';
    }
    return { text: pageText.trim(), items, fontSizes };
}

/**
 * 모든 페이지 처리해서 헤딩 추출 (폰트 크기 상위 ~20%)
 */
function detectHeadings(allItems, allFontSizes) {
    if (allItems.length === 0) return [];
    // 빈도 기준 가장 흔한 폰트 크기 = 본문
    const sizeArr = [...allFontSizes.entries()].sort((a, b) => b[1] - a[1]);
    if (sizeArr.length === 0) return [];
    const bodySize = sizeArr[0][0];
    // 본문보다 1.2배 이상 큰 폰트를 헤딩 후보로
    const headingSizeMin = bodySize * 1.2;
    const headings = [];
    for (const it of allItems) {
        if (it.size >= headingSizeMin && it.str.length >= 3 && it.str.length <= 80) {
            headings.push({ size: it.size, text: it.str });
        }
    }
    // 중복 제거 (같은 텍스트 반복 헤더 방지)
    const seen = new Set();
    return headings.filter(h => {
        const key = h.text;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * 한국어 키워드 빈도 추출
 */
const STOP_WORDS = new Set([
    '있다','없다','한다','합니다','입니다','그리고','하지만','그러나','때문','경우','관련','대한',
    '우리','여기','저기','오늘','어제','내일','이번','지난','모두','많이','조금','더욱','매우',
    '거의','주로','대부분','전체','부분','자료','내용','정보','등','및','또한','특히','다양한',
    '제공','발표','조사','분석','시장','업계','관계자','기업','회사','국내','해외','글로벌',
    '대표','전망','예상','전년','동안','기간','시기','이상','이하','이후','이전','다음','이전',
    '대비','비교','상승','감소','증가','수준','비중','경우','지역','중심','기준','대상','효과',
    '최근','이번','지난','최대','최소','최고','최저'
]);

function extractKoreanKeywords(text, max = 15) {
    if (!text) return [];
    const tokens = (text.match(/[가-힣]{2,}|[A-Za-z][A-Za-z0-9]{2,}/g) || [])
        .filter(t => !STOP_WORDS.has(t));
    const counts = {};
    tokens.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts)
        .filter(([k, v]) => v >= 3) // 3회 이상 등장만
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([keyword, count]) => ({ keyword, count }));
}

/**
 * 메인 분석 함수
 */
export async function analyzePdf(pdfUrl) {
    const arrayBuffer = await fetchPdfBuffer(pdfUrl);
    const data = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;

    const pageCount = pdf.numPages;
    let outline = [];
    try {
        const raw = await pdf.getOutline();
        outline = flattenOutline(raw, 0).slice(0, 50); // 상위 50개만
    } catch { outline = []; }

    let fullText = '';
    const allItems = [];
    const allFontSizes = new Map();
    // 너무 큰 PDF 처리 시간 방지: 최대 50 페이지
    const limit = Math.min(pageCount, 50);
    for (let i = 1; i <= limit; i++) {
        try {
            const page = await pdf.getPage(i);
            const { text, items, fontSizes } = await extractPageContent(page);
            fullText += text + '\n';
            allItems.push(...items);
            for (const [size, count] of fontSizes) {
                allFontSizes.set(size, (allFontSizes.get(size) || 0) + count);
            }
        } catch (err) {
            console.warn(`[analyzePdf] page ${i} failed:`, err.message);
        }
    }

    const headings = detectHeadings(allItems, allFontSizes).slice(0, 30);
    const keywords = extractKoreanKeywords(fullText, 15);

    return {
        url: pdfUrl,
        pageCount,
        analyzedPages: limit,
        outline,           // [{ depth, title }]
        headings,          // [{ size, text }]
        keywords,          // [{ keyword, count }]
        textLength: fullText.length
    };
}
