/**
 * PDF 휴리스틱 분석기 — Node.js 안정 텍스트 추출 (pdf-parse)
 * - PDF 다운로드 → 본문 텍스트 + 페이지 수
 * - 한국어 키워드 빈도 추출 (불용어 사전)
 * - 폰트 기반 헤딩은 pdf-parse 가 노출 안 하므로 제거 (불필요한 의존성 제거)
 *
 * 인사이트 추출용 본문은 별도로 ~12K 토큰까지 제공.
 */
import { PDFParse } from 'pdf-parse';

const UA = 'Mozilla/5.0 (compatible; magazine-bot/1.0; +https://github.com/tlssksek66-sketch/eulpeul)';

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
    return Buffer.from(await res.arrayBuffer());
}

const STOP_WORDS = new Set([
    '있다','없다','한다','합니다','입니다','그리고','하지만','그러나','때문','경우','관련','대한',
    '우리','여기','저기','오늘','어제','내일','이번','지난','모두','많이','조금','더욱','매우',
    '거의','주로','대부분','전체','부분','자료','내용','정보','등','및','또한','특히','다양한',
    '제공','발표','조사','분석','시장','업계','관계자','기업','회사','국내','해외','글로벌',
    '대표','전망','예상','전년','동안','기간','시기','이상','이하','이후','이전','다음',
    '대비','비교','상승','감소','증가','수준','비중','지역','중심','기준','대상','효과',
    '최근','이번','지난','최대','최소','최고','최저'
]);

function extractKoreanKeywords(text, max = 15) {
    if (!text) return [];
    const tokens = (text.match(/[가-힣]{2,}|[A-Za-z][A-Za-z0-9]{2,}/g) || [])
        .filter(t => !STOP_WORDS.has(t));
    const counts = {};
    tokens.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts)
        .filter(([, v]) => v >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([keyword, count]) => ({ keyword, count }));
}

/**
 * 단순 헤딩 후보 추출 — 짧은 줄, 숫자 헤더 패턴
 */
function detectHeadings(text) {
    if (!text) return [];
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const headings = [];
    const seen = new Set();
    for (const line of lines) {
        if (line.length < 4 || line.length > 60) continue;
        // 숫자 챕터, 큰 제목 패턴
        const looksLikeHeading =
            /^[0-9]+[.)]\s/.test(line) ||      // "1. 서론", "1) 개요"
            /^[IVXLC]+[.)]\s/.test(line) ||    // "I. 서론"
            /^[가-힣A-Z][가-힣 A-Za-z0-9]{2,30}$/.test(line) && /[가-힣]/.test(line);
        if (!looksLikeHeading) continue;
        if (seen.has(line)) continue;
        seen.add(line);
        headings.push({ text: line });
        if (headings.length >= 30) break;
    }
    return headings;
}

/**
 * 메인 분석 함수 — pdf-parse v2 PDFParse 클래스 API
 */
export async function analyzePdf(pdfUrl) {
    const buffer = await fetchPdfBuffer(pdfUrl);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const fullText = result.text || '';
    const pageCount = result.total || result.pages?.length || 0;

    return {
        url: pdfUrl,
        pageCount,
        analyzedPages: pageCount,
        outline: [],
        headings: detectHeadings(fullText),
        keywords: extractKoreanKeywords(fullText, 15),
        textLength: fullText.length,
        text: fullText
    };
}
