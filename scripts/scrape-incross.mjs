/**
 * Incross 데이터랩 스크래퍼
 * - 마인카세: https://www.incross.com/ko/insight/news.asp
 * - 마인리포트: https://www.incross.com/ko/insight/report.asp
 *
 * 두 페이지 모두 .news-list .news-slider 카드 구조 사용.
 * 우클릭/드래그가 JS로 막혀 있으나 서버 응답 HTML 스크래핑에는 영향 없음.
 */
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; magazine-bot/1.0; +https://github.com/tlssksek66-sketch/eulpeul)';
const BASE = 'https://www.incross.com/ko/insight/';

const SOURCES = [
    {
        key: 'incross-mineport',
        label: '인크로스 마인리포트',
        publisher: '인크로스',
        listUrl: BASE + 'report.asp',
        detailPattern: 'report.asp?mode=view&idx=',
        defaultCategory: '마인리포트'
    },
    {
        key: 'incross-mineNews',
        label: '인크로스 마인카세',
        publisher: '인크로스',
        listUrl: BASE + 'news.asp',
        detailPattern: 'news.asp?idx=',
        defaultCategory: '마인카세'
    }
];

function normalizeDate(s) {
    if (!s) return '';
    s = s.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return s;
    const m2 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    return s;
}

function absoluteUrl(href, base) {
    if (!href) return '';
    if (/^https?:/i.test(href)) return href;
    if (href.startsWith('//')) return 'https:' + href;
    if (href.startsWith('/')) return 'https://www.incross.com' + href;
    return base + href.replace(/^\.\//, '');
}

export function parseIncrossListPage(html, source) {
    const $ = cheerio.load(html);
    const items = [];
    $('.news-list .news-slider').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        if (!href) return;
        const url = absoluteUrl(href, BASE);

        const title = $el.find('.news-conts dl > dt > div').first().text().trim()
            || $el.find('.news-conts dl > dt').first().text().trim();
        const cate = $el.find('.news-conts .cate').first().text().trim();
        const dateText = $el.find('.news-conts .day').first().text().trim();
        let thumbnail = $el.find('.news-thumb img.ov').attr('src')
            || $el.find('.news-thumb img').last().attr('src')
            || '';
        if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = thumbnail.startsWith('/') ? 'https://www.incross.com' + thumbnail : BASE + thumbnail;
        }

        if (!title) return;

        items.push({
            source: source.key,
            sourceLabel: source.label,
            publisher: source.publisher,
            title,
            category: cate || source.defaultCategory,
            date: normalizeDate(dateText),
            url,
            pdfUrl: '', // Incross는 PDF 직접 다운로드 없음 — detail page 링크만
            thumbnail
        });
    });
    return items;
}

export async function scrapeIncrossSource(source) {
    try {
        const res = await fetch(source.listUrl, {
            headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }
        });
        if (!res.ok) {
            console.warn(`[incross] ${source.key}: HTTP ${res.status}`);
            return [];
        }
        const html = await res.text();
        const items = parseIncrossListPage(html, source);
        console.log(`[incross] ${source.label}: ${items.length}건`);
        return items;
    } catch (err) {
        console.error(`[incross] ${source.key} failed:`, err.message);
        return [];
    }
}

export async function scrapeAllIncross() {
    const all = [];
    for (const src of SOURCES) {
        const items = await scrapeIncrossSource(src);
        all.push(...items);
    }
    return all;
}

export { SOURCES as INCROSS_SOURCES };
