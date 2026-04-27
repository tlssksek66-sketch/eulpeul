/**
 * Nasmedia 나스리포트 스크래퍼
 * - 정기보고서: https://www.nasmedia.co.kr/나스리포트/정기보고서/
 * - NPR:        https://www.nasmedia.co.kr/나스리포트/npr/
 *
 * 두 페이지 모두 jt_grid_list_item WordPress 플러그인 마크업을 사용 — 같은 셀렉터.
 *
 * 추출 필드: title, category, date, url, pdfUrl, thumbnail
 */
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; magazine-bot/1.0; +https://github.com/tlssksek66-sketch/eulpeul)';

const SOURCES = [
    {
        key: 'nasmedia-regular',
        label: '나스리포트 정기보고서',
        publisher: '케이티 나스미디어',
        listUrl: 'https://www.nasmedia.co.kr/나스리포트/정기보고서/'
    },
    {
        key: 'nasmedia-npr',
        label: '나스리포트 NPR',
        publisher: '케이티 나스미디어',
        listUrl: 'https://www.nasmedia.co.kr/나스리포트/npr/'
    }
];

/**
 * 한 페이지(목록)에서 모든 아이템 추출
 */
export function parseNasmediaListPage(html, source) {
    const $ = cheerio.load(html);
    const items = [];
    $('.jt_grid_list_item').each((_, el) => {
        const $el = $(el);
        const url = $el.attr('href') || '';
        const title = $el.find('.jt_grid_list_title span').first().text().trim()
            || $el.find('.jt_grid_list_title').first().text().trim();
        const category = $el.find('.jt_grid_list_category span').first().text().trim();
        const dateAttr = $el.find('time.jt_grid_list_date').attr('datetime');
        const dateText = $el.find('time.jt_grid_list_date').text().trim();
        const pdfUrl = $el.find('button.jt_grid_list_download').attr('data-download') || '';
        let thumbnail = $el.find('figure img').attr('data-unveil')
            || $el.find('figure img').attr('src') || '';
        if (thumbnail && !thumbnail.startsWith('http')) thumbnail = '';

        if (!url || !title) return;

        items.push({
            source: source.key,
            sourceLabel: source.label,
            publisher: source.publisher,
            title,
            category: category || '기타',
            date: normalizeDate(dateAttr || dateText),
            url,
            pdfUrl,
            thumbnail
        });
    });
    return items;
}

/**
 * 날짜 문자열 → "YYYY-MM-DD"
 */
function normalizeDate(s) {
    if (!s) return '';
    s = s.trim();
    // ISO: 2026-04-16
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return s;
    // 도트: 2026.04.16
    m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return s;
}

/**
 * 한 소스의 첫 N 페이지를 받아 클리핑 배열로 반환
 */
export async function scrapeNasmediaSource(source, { maxPages = 3 } = {}) {
    const allItems = [];
    for (let page = 1; page <= maxPages; page++) {
        const url = page === 1
            ? source.listUrl
            : source.listUrl.replace(/\/$/, '') + `/page/${page}/`;
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }
            });
            if (!res.ok) {
                console.warn(`[nasmedia] ${source.key} page ${page}: HTTP ${res.status}`);
                break;
            }
            const html = await res.text();
            const items = parseNasmediaListPage(html, source);
            if (items.length === 0) {
                console.warn(`[nasmedia] ${source.key} page ${page}: 0 items (selector mismatch?)`);
                break;
            }
            allItems.push(...items);
        } catch (err) {
            console.error(`[nasmedia] ${source.key} page ${page} failed:`, err.message);
            break;
        }
    }
    return allItems;
}

/**
 * 전체 Nasmedia 소스 수집
 */
export async function scrapeAllNasmedia(opts) {
    const all = [];
    for (const src of SOURCES) {
        const items = await scrapeNasmediaSource(src, opts);
        console.log(`[nasmedia] ${src.label}: ${items.length}건`);
        all.push(...items);
    }
    return all;
}

export { SOURCES as NASMEDIA_SOURCES };
