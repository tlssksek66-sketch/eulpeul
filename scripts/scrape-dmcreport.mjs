/**
 * DMC리포트 스크래퍼
 * - 리포트 전체: https://www.dmcreport.co.kr/report
 * - 광고/마케팅: https://www.dmcreport.co.kr/admarketing
 *
 * 사이트 특성:
 *   · Vue.js SPA — Vue Router 기반으로 detail href 가 비어있음
 *   · 그러나 `__NEXT_DATA__` 처럼 SSR 렌더된 마크업에는 카드 메타가 노출됨
 *   · detail URL 은 `/contentview?dr_code=DMCRPF{...}` 패턴이지만 dr_code 가 카드에 노출 X
 *   · 따라서 detail 링크는 발행처 listing 페이지로 fallback
 */
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; magazine-bot/1.0; +https://github.com/tlssksek66-sketch/eulpeul)';

const SOURCE = {
    key: 'dmcreport',
    label: 'DMC리포트',
    publisher: 'DMC미디어',
    listUrl: 'https://www.dmcreport.co.kr/report'
};

function normalizeDate(s) {
    if (!s) return '';
    s = s.trim();
    const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return s;
    return s;
}

/**
 * "마켓 > 식품/음료  |  2026.04.27" → { categories: ["마켓","식품/음료"], date: "2026-04-27" }
 */
export function parseDmcMeta(metaText) {
    if (!metaText) return { categories: [], date: '' };
    //   (nbsp) 정규화
    const text = metaText.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    const lastBar = text.lastIndexOf('|');
    if (lastBar === -1) return { categories: [text], date: '' };
    const catPart = text.slice(0, lastBar).trim();
    const datePart = text.slice(lastBar + 1).trim();
    const categories = catPart.split('>').map(c => c.trim()).filter(Boolean);
    return { categories, date: normalizeDate(datePart) };
}

export function parseDmcListPage(html) {
    const $ = cheerio.load(html);
    const items = [];
    $('.content_list li.bnrWarp').each((_, el) => {
        const $el = $(el);
        const title = $el.find('.cont_tit').first().text().trim();
        const metaText = $el.find('.cont_sub_txt').first().text().trim();
        const { categories, date } = parseDmcMeta(metaText);
        const thumbnail = $el.find('.content_bnr img').first().attr('src') || '';
        const tags = [];
        $el.find('.tagbox_01 .tag01').each((_, t) => {
            const tag = $(t).text().trim().replace(/^#/, '');
            if (tag) tags.push(tag);
        });
        if (!title) return;

        items.push({
            source: SOURCE.key,
            sourceLabel: SOURCE.label,
            publisher: SOURCE.publisher,
            title,
            category: categories[0] || '기타',
            categories: categories.length > 0 ? categories : ['기타'],
            date,
            // Vue Router 가 가로채서 직접 detail URL 추출 불가 — 발행처 listing 으로 fallback
            url: SOURCE.listUrl,
            pdfUrl: '', // DMC 는 회원만 PDF 다운로드 가능
            thumbnail,
            tags
        });
    });
    return items;
}

export async function scrapeDmcReport() {
    try {
        const res = await fetch(SOURCE.listUrl, {
            headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }
        });
        if (!res.ok) {
            console.warn(`[dmcreport] HTTP ${res.status}`);
            return [];
        }
        const html = await res.text();
        const items = parseDmcListPage(html);
        console.log(`[dmcreport] ${SOURCE.label}: ${items.length}건`);
        return items;
    } catch (err) {
        console.error(`[dmcreport] failed:`, err.message);
        return [];
    }
}

export { SOURCE as DMCREPORT_SOURCE };
