/**
 * CJ Mezzo Media Insight-M 스크래퍼
 * - URL: https://www.cjmezzomedia.com/insight-m
 *
 * 사이트 특성:
 *   · Next.js 기반, 페이지당 6건 SSR 렌더
 *   · 페이지네이션은 클라이언트 사이드 (자바스크립트 필요) → 첫 페이지만 수집
 *   · 카드 클릭 시 별도 디테일 페이지 없이 PDF 직접 다운로드
 *
 * 추출 필드: title, category, date, url(=pdfUrl), pdfUrl, thumbnail, fileSize
 */
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; magazine-bot/1.0; +https://github.com/tlssksek66-sketch/eulpeul)';

const SOURCE = {
    key: 'cjmezzo-insight-m',
    label: 'CJ Mezzo Insight-M',
    publisher: 'CJ 메조미디어',
    listUrl: 'https://www.cjmezzomedia.com/insight-m'
};

/**
 * 메타 텍스트 파싱 — "타겟 분석 / 리서치 데이터 . 2026.03.31"
 * 마지막 " . " 구분자 기준으로 분리. 그 이전이 카테고리(여러개), 이후가 날짜.
 */
export function parseInsightMeta(metaText) {
    if (!metaText) return { categories: [], date: '' };
    const text = metaText.replace(/\s+/g, ' ').trim();
    // 마지막 ' . ' 구분자 위치
    const lastDot = text.lastIndexOf(' . ');
    if (lastDot === -1) return { categories: [text], date: '' };
    const catPart = text.slice(0, lastDot).trim();
    const datePart = text.slice(lastDot + 3).trim();
    const categories = catPart.split('/').map(c => c.trim()).filter(Boolean);
    return { categories, date: normalizeDate(datePart) };
}

/**
 * 날짜 "2026.03.31" → "2026-03-31"
 */
function normalizeDate(s) {
    if (!s) return '';
    const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return s;
    return s;
}

/**
 * 파일 크기 파싱 — "Download(1.8 MB)" → "1.8 MB"
 */
function parseFileSize(text) {
    if (!text) return '';
    const m = text.match(/\(([^)]+)\)/);
    return m ? m[1].trim() : '';
}

export function parseCjMezzoListPage(html) {
    const $ = cheerio.load(html);
    const items = [];
    $('article.insight__item').each((_, el) => {
        const $el = $(el);
        const titleA = $el.find('.insight__title a').first();
        const title = titleA.text().trim();
        const pdfUrl = titleA.attr('href') || $el.find('.insight__btn').attr('href') || '';
        if (!title || !pdfUrl) return;

        const metaText = $el.find('.insight__meta').first().text().trim();
        const { categories, date } = parseInsightMeta(metaText);
        const thumbnail = $el.find('.insight__img img').first().attr('src') || '';
        const fileSize = parseFileSize($el.find('.insight__btn').text());

        items.push({
            source: SOURCE.key,
            sourceLabel: SOURCE.label,
            publisher: SOURCE.publisher,
            title,
            category: categories[0] || '기타',
            categories: categories.length > 0 ? categories : ['기타'],
            date,
            url: pdfUrl,
            pdfUrl,
            thumbnail,
            fileSize
        });
    });
    return items;
}

/**
 * CJ Mezzo Insight-M 첫 페이지 수집
 * (페이지네이션이 JS-only라 1페이지만 — 보통 최근 6건 = 약 2-3개월치)
 */
export async function scrapeCjMezzo() {
    try {
        const res = await fetch(SOURCE.listUrl, {
            headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }
        });
        if (!res.ok) {
            console.warn(`[cjmezzo] HTTP ${res.status}`);
            return [];
        }
        const html = await res.text();
        const items = parseCjMezzoListPage(html);
        console.log(`[cjmezzo] ${SOURCE.label}: ${items.length}건`);
        return items;
    } catch (err) {
        console.error(`[cjmezzo] failed:`, err.message);
        return [];
    }
}

export { SOURCE as CJMEZZO_SOURCE };
