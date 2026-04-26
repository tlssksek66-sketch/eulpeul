/**
 * 샥즈 코리아 매거진 - Naver Search Aggregator (News + Blog + Cafe)
 * Google Apps Script Web App
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  배포 가이드
 * ──────────────────────────────────────────────────────────────────────────
 *  1) 네이버 개발자센터(https://developers.naver.com)에서 "검색" API 사용 등록
 *     → Client ID / Client Secret 발급
 *
 *  2) Apps Script 프로젝트 생성 후 본 파일을 그대로 붙여넣기
 *
 *  3) 좌측 톱니바퀴(프로젝트 설정) → "스크립트 속성" → 아래 두 키 추가:
 *       NAVER_CLIENT_ID       = (발급받은 Client ID)
 *       NAVER_CLIENT_SECRET   = (발급받은 Client Secret)
 *
 *  4) 우상단 "배포" → "새 배포" → 유형: 웹 앱
 *       - 다음 사용자 권한으로 실행: 나
 *       - 액세스 권한: 모든 사용자(또는 도메인 내 모든 사용자)
 *     → 배포 → 표시되는 웹 앱 URL을 매거진 화면의
 *       "Apps Script URL" 필드에 붙여넣기
 *
 *  5) 호출 파라미터:
 *       ?format=html                  (기본: 매거진 HTML 페이지로 렌더링)
 *       ?format=json                  (eulpeul 프론트엔드용 JSON 응답)
 *       &query=샥즈 코리아           (검색어, 기본 "샥즈 코리아")
 *       &display=20                  (각 채널당 1~100건)
 *       &channels=news,blog,cafe     (조합 가능)
 *       &sort=date                   ('date' | 'sim', 기본 date)
 *       &strict=true|false           (관련성 필터, 기본 true)
 *       &cat=all|product|review|tech|sports|marketing|press|community  (HTML 모드 카테고리 탭)
 *
 *  HTML 모드: 브라우저에서 URL 열면 매거진 형태로 즉시 표시
 *  JSON 응답 스키마(요약):
 *  {
 *    query, fetchedAt, strict, total,
 *    counts: { news, blog, cafearticle },           // 채널별 원본 수신
 *    filteredCounts: { news, blog, cafearticle },   // 필터 통과
 *    droppedByRelevance: N,                         // 관련성 필터 제외 합계
 *    items: [{ id, title, excerpt, url, date, channel,
 *              category, source, sourceColor, tags,
 *              sentiment, bloggerName?, cafeName? }],
 *    errors?: { news?: '...', blog?: '...' }
 *  }
 * ──────────────────────────────────────────────────────────────────────────
 */

const NAVER_BASE = 'https://openapi.naver.com/v1/search';

const CHANNEL_ALIAS = {
  news: 'news',
  blog: 'blog',
  cafe: 'cafearticle',
  cafearticle: 'cafearticle'
};

// 매체 호스트 → 표시명·컬러 매핑 (지속 추가 가능)
const NEWS_SOURCE_MAP = {
  // IT/테크
  'zdnet.co.kr':         { name: '지디넷코리아',   color: '#0066ff' },
  'it.chosun.com':       { name: 'IT조선',        color: '#e60012' },
  'it.donga.com':        { name: 'IT동아',        color: '#003478' },
  'etnews.com':          { name: '전자신문',      color: '#1976d2' },
  'ddaily.co.kr':        { name: '디지털데일리',  color: '#1e88e5' },
  'thegear.net':         { name: '더기어',        color: '#212121' },
  'kbench.com':          { name: '케이벤치',      color: '#00838f' },
  'bloter.net':          { name: '블로터',        color: '#0288d1' },
  // 종합 일간지
  'biz.chosun.com':      { name: '조선비즈',      color: '#0033a0' },
  'chosun.com':          { name: '조선일보',      color: '#0033a0' },
  'donga.com':           { name: '동아일보',      color: '#003478' },
  'sports.donga.com':    { name: '스포츠동아',    color: '#d32f2f' },
  'mk.co.kr':            { name: '매일경제',      color: '#cc0000' },
  'edaily.co.kr':        { name: '이데일리',      color: '#ff5722' },
  'hani.co.kr':          { name: '한겨레',        color: '#005bac' },
  'khan.co.kr':          { name: '경향신문',      color: '#cc0000' },
  'joongang.co.kr':      { name: '중앙일보',      color: '#e60012' },
  'hankyung.com':        { name: '한국경제',      color: '#1565c0' },
  'mt.co.kr':            { name: '머니투데이',    color: '#d32f2f' },
  'news.mt.co.kr':       { name: '머니투데이',    color: '#d32f2f' },
  'yna.co.kr':           { name: '연합뉴스',      color: '#005bac' },
  'news1.kr':            { name: '뉴스1',         color: '#212121' },
  'newsis.com':          { name: '뉴시스',        color: '#1565c0' },
  'etoday.co.kr':        { name: '이투데이',      color: '#1976d2' },
  'biztribune.co.kr':    { name: '비즈트리뷴',    color: '#2e7d32' },
  'heraldcorp.com':      { name: '헤럴드경제',    color: '#0033a0' },
  'news.heraldcorp.com': { name: '헤럴드경제',    color: '#0033a0' },
  'mediapen.com':        { name: '미디어펜',      color: '#1976d2' },
  // 자동차/모터스포츠
  'gpkorea.com':         { name: '지피코리아',    color: '#1a73e8' },
  'autodaily.co.kr':     { name: '오토데일리',    color: '#212121' },
  // 스포츠/라이프
  'sports.khan.co.kr':   { name: '스포츠경향',    color: '#ff6600' },
  'sports.chosun.com':   { name: '스포츠조선',    color: '#e60012' },
  'sportsworldi.com':    { name: '스포츠월드',    color: '#0d47a1' },
  'runnersworld.co.kr':  { name: '러너스월드',    color: '#ff5252' },
  'bike.chosun.com':     { name: '바이크조선',    color: '#388e3c' },
  // 헬스/리빙
  'health.chosun.com':   { name: '헬스조선',      color: '#28a745' },
  'kormedi.com':         { name: '코메디닷컴',    color: '#0277bd' },
  // 패션/매거진
  'fashionbiz.co.kr':    { name: '패션비즈',      color: '#9c27b0' },
  'gqkorea.co.kr':       { name: 'GQ 코리아',     color: '#000000' },
  'esquirekorea.co.kr':  { name: '에스콰이어',    color: '#212121' },
  'womansense.co.kr':    { name: '우먼센스',      color: '#e91e63' }
};

// 샥즈 관련성 판단용 키워드 (정확도 필터 strict=true 시 적용)
const SHOKZ_RELEVANCE = [
  '샥즈', '쇼크즈', 'Shokz', 'shokz', 'SHOKZ',
  '애프터샥', 'AfterShokz', 'aftershokz',
  'OpenRun', '오픈런', 'OpenFit', '오픈핏',
  'OpenSwim', '오픈스윔', 'OpenMove', '오픈무브',
  'OpenComm', '오픈컴', 'OpenDot', '오픈닷', 'OpenGolf', '오픈골프',
  '골전도'
];

const SHOKZ_KEYWORDS = [
  'OpenRun', 'OpenFit', 'OpenSwim', 'OpenMove', 'OpenComm', 'OpenGolf',
  '골전도', '러닝', '사이클', '수영', '골프', '마라톤', '트라이애슬론'
];

/**
 * 메인 엔드포인트
 *   format=html (기본): 매거진 HTML 페이지 렌더링
 *   format=json       : 정규화된 JSON 응답 (eulpeul 프론트엔드용)
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const format = (params.format || 'html').toLowerCase();
  const data = buildMagazineData(params);

  if (data.error) {
    if (format === 'json') return jsonOut(data);
    return htmlOut(renderErrorPage(data.error));
  }

  if (format === 'json') return jsonOut(data);
  return htmlOut(renderMagazineHtml(data, params));
}

/**
 * 네이버 검색 호출 → 정규화 → 필터링 → 정렬까지 수행하고 결과를 반환
 */
function buildMagazineData(params) {
  const query = (params.query || '샥즈 코리아').trim();
  const display = clampInt(params.display, 1, 100, 20);
  const sort = (params.sort === 'sim') ? 'sim' : 'date';
  // 정확도 필터 (default: true) — false 명시 시에만 비활성
  const strict = String(params.strict || 'true').toLowerCase() !== 'false';
  const channelsRaw = (params.channels || 'news,blog,cafe').split(',')
    .map(s => s.trim().toLowerCase()).filter(Boolean);
  const channels = channelsRaw
    .map(c => CHANNEL_ALIAS[c])
    .filter(Boolean);

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('NAVER_CLIENT_ID');
  const clientSecret = props.getProperty('NAVER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return {
      error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 스크립트 속성이 설정되지 않았습니다. ' +
             '프로젝트 설정 → 스크립트 속성에 키를 추가하세요.'
    };
  }

  const all = [];
  const counts = {};       // 채널별 원본 건수
  const filtered = {};     // 채널별 필터 통과 건수
  const errors = {};
  let droppedTotal = 0;

  channels.forEach(ch => {
    try {
      const items = fetchChannel(ch, query, display, sort, clientId, clientSecret);
      counts[ch] = items.length;
      let kept = 0;
      items.forEach(it => {
        const normalized = normalize(it, ch);
        if (strict && !isShokzRelevant(normalized)) {
          droppedTotal++;
          return;
        }
        all.push(normalized);
        kept++;
      });
      filtered[ch] = kept;
    } catch (err) {
      errors[ch] = String(err && err.message || err);
    }
  });

  // 제목 기준 중복 제거 (동일 기사가 여러 채널에 나올 수 있음)
  const seen = {};
  const unique = [];
  all.forEach(a => {
    const key = (a.title || '').replace(/\s+/g, ' ').trim();
    if (!key || seen[key]) return;
    seen[key] = true;
    unique.push(a);
  });

  // 최신순 정렬
  unique.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // 안정 ID(타임스탬프 + 채널 + 인덱스) 부여
  const stamp = Date.now();
  unique.forEach((a, i) => { a.id = 'n' + stamp + '_' + i; });

  return {
    query: query,
    fetchedAt: new Date().toISOString(),
    strict: strict,
    total: unique.length,
    counts: counts,                       // 채널별 원본 수신 건수
    filteredCounts: filtered,             // 채널별 필터 통과 건수
    droppedByRelevance: droppedTotal,     // 정확도 필터에 의해 제외된 총 건수
    items: unique,
    errors: Object.keys(errors).length ? errors : undefined
  };
}

/**
 * 샥즈 관련성 판단 — 제목 또는 본문에 SHOKZ_RELEVANCE 키워드가 하나라도
 * 포함되면 통과. 노이즈(샥즈가 본문 끝에 살짝 언급된 경우 등) 제거.
 */
function isShokzRelevant(article) {
  const text = (article.title || '') + ' ' + (article.excerpt || '');
  for (let i = 0; i < SHOKZ_RELEVANCE.length; i++) {
    if (text.indexOf(SHOKZ_RELEVANCE[i]) !== -1) return true;
  }
  return false;
}

/**
 * 단일 채널 호출
 */
function fetchChannel(endpoint, query, display, sort, clientId, clientSecret) {
  const url = NAVER_BASE + '/' + endpoint + '.json'
    + '?query=' + encodeURIComponent(query)
    + '&display=' + display
    + '&sort=' + sort;
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret
    },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) {
    throw new Error('HTTP ' + code + ' / ' + body.slice(0, 200));
  }
  const json = JSON.parse(body);
  return json.items || [];
}

/**
 * 네이버 응답 항목 → 매거진 article 스키마로 정규화
 */
function normalize(item, channel) {
  const title = stripTags(item.title);
  const excerpt = stripTags(item.description);
  const url = item.link || item.originallink || '';
  const date = parseDate(item.pubDate || item.postdate);

  return {
    title: title,
    excerpt: excerpt,
    url: url,
    date: date,
    channel: channel,                                   // 'news' | 'blog' | 'cafearticle'
    category: inferCategory(channel, title, excerpt),
    source: inferSourceName(channel, item, url),
    sourceColor: inferSourceColor(channel, url),
    tags: extractTags(channel, title + ' ' + excerpt),
    sentiment: inferSentiment(title + ' ' + excerpt),
    bloggerName: item.bloggername || undefined,
    cafeName: item.cafename || undefined,
    type: channelType(channel),
    author: channelAuthor(channel, item)
  };
}

function channelType(ch) {
  if (ch === 'blog') return 'review';
  if (ch === 'cafearticle') return 'community';
  return 'news';
}

function channelAuthor(ch, item) {
  if (ch === 'blog') return item.bloggername || '네이버 블로거';
  if (ch === 'cafearticle') return item.cafename || '네이버 카페';
  return '편집부';
}

function inferCategory(channel, title, desc) {
  if (channel === 'blog') return 'review';
  if (channel === 'cafearticle') return 'community';
  const t = (title + ' ' + desc).toLowerCase();
  if (/리뷰|후기|체험|시승/.test(t)) return 'review';
  if (/출시|신제품|공개|발표|공식/.test(t)) return 'product';
  if (/특허|기술|연구|학회|코덱|펌웨어|ai/.test(t)) return 'tech';
  if (/마라톤|러닝|사이클|골프|수영|선수|운동|트라이애슬론/.test(t)) return 'sports';
  if (/캠페인|광고|모델|앰배서더|매장|할인|프로모션|콜라보/.test(t)) return 'marketing';
  if (/sns|인플루언서|인스타|유튜브/.test(t)) return 'community';
  return 'press';
}

function inferSourceName(channel, item, url) {
  if (channel === 'blog') {
    return item.bloggername ? '네이버 블로그 · ' + item.bloggername : '네이버 블로그';
  }
  if (channel === 'cafearticle') {
    return item.cafename ? '네이버 카페 · ' + item.cafename : '네이버 카페';
  }
  const host = extractHost(url);
  const m = NEWS_SOURCE_MAP[host];
  return m ? m.name : (host || '뉴스');
}

function inferSourceColor(channel, url) {
  if (channel === 'blog') return '#03c75a';
  if (channel === 'cafearticle') return '#03c75a';
  const host = extractHost(url);
  const m = NEWS_SOURCE_MAP[host];
  return m ? m.color : '#8b90a0';
}

function extractTags(channel, text) {
  const tags = [];
  if (channel === 'blog') tags.push('블로그');
  if (channel === 'cafearticle') tags.push('카페');
  SHOKZ_KEYWORDS.forEach(k => {
    if (text.indexOf(k) !== -1 && tags.indexOf(k) === -1) tags.push(k);
  });
  return tags;
}

function inferSentiment(text) {
  const t = text.toLowerCase();
  const pos = /추천|만족|호평|최고|좋|훌륭|성공|1위|1위에|혁신|신기록/;
  const neg = /문제|결함|논란|불만|리콜|소송|하락|실패|악화/;
  if (neg.test(t)) return 'negative';
  if (pos.test(t)) return 'positive';
  return 'neutral';
}

/* ───── utilities ───── */

function stripTags(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// 입력: pubDate(RFC 형식) 또는 postdate(YYYYMMDD) → "YYYY-MM-DD"
function parseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = String(raw);
  if (/^\d{8}$/.test(s)) {
    return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function extractHost(url) {
  if (!url) return '';
  const m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
  if (!m) return '';
  return m[1].replace(/^www\./, '').toLowerCase();
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function jsonOut(obj, statusCode) {
  // Apps Script는 임의 status code를 거의 지원하지 않지만, error 필드로 클라가 분기 가능
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlOut(html) {
  return HtmlService.createHtmlOutput(html)
    .setTitle('샥즈 코리아 매거진')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ───── HTML 매거진 렌더러 ───── */

const CATEGORY_META = {
  product:   { label: '신제품',     color: '#4a7cff', grad: 'linear-gradient(135deg,#1e3a8a,#4a7cff,#6b99ff)' },
  review:    { label: '리뷰',       color: '#34d399', grad: 'linear-gradient(135deg,#064e3b,#34d399,#6ee7b7)' },
  tech:      { label: '기술',       color: '#a78bfa', grad: 'linear-gradient(135deg,#4c1d95,#a78bfa,#c4b5fd)' },
  sports:    { label: '스포츠',     color: '#fbbf24', grad: 'linear-gradient(135deg,#78350f,#fbbf24,#fcd34d)' },
  marketing: { label: '마케팅',     color: '#f87171', grad: 'linear-gradient(135deg,#7f1d1d,#f87171,#fca5a5)' },
  press:     { label: '보도/IR',    color: '#22d3ee', grad: 'linear-gradient(135deg,#134e4a,#22d3ee,#67e8f9)' },
  community: { label: '커뮤니티',   color: '#fb923c', grad: 'linear-gradient(135deg,#7c2d12,#fb923c,#fdba74)' }
};

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderErrorPage(message) {
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>샥즈 매거진 - 오류</title>'
    + '<style>body{margin:0;background:#0f1117;color:#e8eaf0;font-family:"Noto Sans KR",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;}'
    + '.err{max-width:560px;background:#1e2132;border:1px solid #f87171;border-radius:12px;padding:32px;text-align:center}'
    + '.err h1{font-size:18px;margin:0 0 12px;color:#f87171}'
    + '.err p{font-size:14px;line-height:1.6;color:#8b90a0;margin:0}</style></head>'
    + '<body><div class="err"><h1>⚠ 샥즈 매거진 오류</h1><p>' + escapeHtml(message) + '</p></div></body></html>';
}

function buildSourceStats(items) {
  const map = {};
  items.forEach(it => {
    if (!map[it.source]) map[it.source] = { count: 0, color: it.sourceColor || '#8b90a0' };
    map[it.source].count++;
  });
  const arr = [];
  for (const k in map) arr.push([k, map[k].count, map[k].color]);
  arr.sort((a, b) => b[1] - a[1]);
  return arr.slice(0, 10);
}

function buildTagStats(items) {
  const map = {};
  items.forEach(it => (it.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
  const arr = [];
  for (const k in map) arr.push([k, map[k]]);
  arr.sort((a, b) => b[1] - a[1]);
  return arr.slice(0, 16);
}

function categoryChip(cat) {
  const m = CATEGORY_META[cat] || { label: cat, color: '#888' };
  return '<span class="cat-chip" style="background:' + m.color + '">' + escapeHtml(m.label) + '</span>';
}

function categoryGradient(cat) {
  return (CATEGORY_META[cat] && CATEGORY_META[cat].grad) || 'linear-gradient(135deg,#1f2937,#4a7cff)';
}

function sourceChip(item) {
  const color = item.sourceColor || '#8b90a0';
  return '<span class="src-chip"><span class="src-dot" style="background:' + color + '"></span>' + escapeHtml(item.source) + '</span>';
}

function formatDateLabel(item) {
  if (!item.date) return '';
  const t = new Date(item.date).getTime();
  if (isNaN(t)) return item.date;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '1일 전';
  if (days < 30) return days + '일 전';
  return item.date;
}

function renderHero(item) {
  if (!item) return '';
  const link = item.url ? ' onclick="window.open(\'' + escapeHtml(item.url) + '\',\'_blank\')"' : '';
  return '<article class="hero" data-cat="' + escapeHtml(item.category) + '"' + link + '>'
    + '<div class="hero-img" style="background-image:' + categoryGradient(item.category) + '">'
    +   '<span class="watermark">SHOKZ</span>'
    +   '<div class="hero-cat">' + categoryChip(item.category) + '</div>'
    + '</div>'
    + '<div class="hero-body">'
    +   '<div class="meta-row">' + sourceChip(item)
    +     '<span class="meta-dot">·</span><span class="meta-dim">' + escapeHtml(formatDateLabel(item)) + '</span>'
    +   '</div>'
    +   '<h2 class="hero-title">' + escapeHtml(item.title) + '</h2>'
    +   '<p class="hero-excerpt">' + escapeHtml(item.excerpt) + '</p>'
    +   '<div class="hero-foot">by ' + escapeHtml(item.author || '편집부')
    +     '<span class="meta-dot">·</span>'
    +     '<span class="tags">' + (item.tags || []).map(function(t){ return '#' + escapeHtml(t); }).join(' ') + '</span>'
    +   '</div>'
    + '</div>'
    + '</article>';
}

function renderSubCard(item) {
  const link = item.url ? ' onclick="window.open(\'' + escapeHtml(item.url) + '\',\'_blank\')"' : '';
  return '<article class="sub-card" data-cat="' + escapeHtml(item.category) + '"' + link + '>'
    + '<div class="sub-img" style="background-image:' + categoryGradient(item.category) + '">'
    +   '<div class="sub-cat">' + categoryChip(item.category) + '</div>'
    + '</div>'
    + '<div class="sub-body">'
    +   '<h4 class="sub-title">' + escapeHtml(item.title) + '</h4>'
    +   '<p class="sub-excerpt">' + escapeHtml(item.excerpt) + '</p>'
    +   '<div class="sub-foot">' + sourceChip(item)
    +     '<span class="meta-dim">' + escapeHtml(formatDateLabel(item)) + '</span>'
    +   '</div>'
    + '</div>'
    + '</article>';
}

function renderCard(item) {
  const link = item.url ? ' onclick="window.open(\'' + escapeHtml(item.url) + '\',\'_blank\')"' : '';
  return '<article class="card" data-cat="' + escapeHtml(item.category) + '"' + link + '>'
    + '<div class="card-img" style="background-image:' + categoryGradient(item.category) + '">'
    +   '<div class="card-cat">' + categoryChip(item.category) + '</div>'
    + '</div>'
    + '<div class="card-body">'
    +   '<h4 class="card-title">' + escapeHtml(item.title) + '</h4>'
    +   '<p class="card-excerpt">' + escapeHtml(item.excerpt) + '</p>'
    +   '<div class="card-foot">' + sourceChip(item)
    +     '<span class="meta-dim">' + escapeHtml(formatDateLabel(item)) + '</span>'
    +   '</div>'
    + '</div>'
    + '</article>';
}

function renderSourceBars(items) {
  const arr = buildSourceStats(items);
  if (!arr.length) return '<p class="empty-mini">데이터 없음</p>';
  const max = arr[0][1];
  return arr.map(function(row) {
    const pct = (row[1] / max * 100).toFixed(0);
    return '<div class="src-row">'
      + '<span class="src-name" title="' + escapeHtml(row[0]) + '">' + escapeHtml(row[0]) + '</span>'
      + '<span class="src-bar"><span class="src-bar-fill" style="width:' + pct + '%;background:' + row[2] + '"></span></span>'
      + '<span class="src-count">' + row[1] + '</span>'
      + '</div>';
  }).join('');
}

function renderTagCloud(items) {
  const arr = buildTagStats(items);
  if (!arr.length) return '<p class="empty-mini">데이터 없음</p>';
  return arr.map(function(row, i) {
    const cls = i < 3 ? 'tag tag-hot' : 'tag';
    return '<span class="' + cls + '">#' + escapeHtml(row[0]) + ' <small>' + row[1] + '</small></span>';
  }).join('');
}

function renderLiveFeed(items) {
  const latest = items.slice(0, 8);
  if (!latest.length) return '<p class="empty-mini">데이터 없음</p>';
  return latest.map(function(it) {
    const link = it.url ? ' onclick="window.open(\'' + escapeHtml(it.url) + '\',\'_blank\')"' : '';
    return '<div class="feed-item"' + link + '>'
      + '<div class="feed-title">' + escapeHtml(it.title) + '</div>'
      + '<div class="feed-meta">' + escapeHtml(it.source) + ' · ' + escapeHtml(formatDateLabel(it)) + '</div>'
      + '</div>';
  }).join('');
}

function renderTabs(activeCat) {
  const tabs = [
    ['all', '전체'], ['product', '신제품'], ['review', '리뷰'], ['tech', '기술'],
    ['sports', '스포츠'], ['marketing', '마케팅'], ['press', '보도'], ['community', '커뮤니티']
  ];
  return tabs.map(function(t) {
    const active = (activeCat === t[0]) ? ' active' : '';
    return '<button class="tab' + active + '" data-cat="' + t[0] + '">' + escapeHtml(t[1]) + '</button>';
  }).join('');
}

function renderMagazineHtml(data, params) {
  const items = data.items || [];
  const cat = (params.cat || 'all').toLowerCase();
  const q = (params.q || '').trim();

  // 통계
  const sourceCount = (function() {
    const s = {}; items.forEach(it => s[it.source] = 1);
    let c = 0; for (const k in s) c++; return c;
  })();
  const channelStat = data.filteredCounts || {};
  const droppedNote = data.droppedByRelevance || 0;

  const hero = items[0];
  const subs = items.slice(1, 4);
  const rest = items.slice(4);

  const fetchedLabel = (function() {
    try { return new Date(data.fetchedAt).toLocaleString('ko-KR'); } catch (e) { return data.fetchedAt; }
  })();

  // 채널 카운트 라인
  const counts = data.counts || {};
  const channelLine = Object.keys(counts).map(function(k) {
    const f = (channelStat[k] !== undefined) ? channelStat[k] + '/' + counts[k] : counts[k];
    return k + ':' + f;
  }).join(' · ');

  return '<!DOCTYPE html><html lang="ko"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>샥즈 코리아 매거진</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">'
    + '<style>' + MAGAZINE_CSS + '</style>'
    + '</head><body>'
    + '<header class="topbar">'
    +   '<div class="brand">'
    +     '<span class="brand-mark">SHOKZ</span>'
    +     '<span class="brand-divider">|</span>'
    +     '<span class="brand-sub">KOREA · CLIPPING MAGAZINE</span>'
    +   '</div>'
    +   '<div class="search-wrap">'
    +     '<input type="text" id="searchInput" placeholder="제목·요약·태그 검색..." value="' + escapeHtml(q) + '">'
    +     '<button class="refresh-btn" onclick="location.reload()" title="새로고침">⟳</button>'
    +   '</div>'
    + '</header>'

    + '<section class="hero-section">'
    +   '<h1>샥즈 코리아 매거진</h1>'
    +   '<p class="tagline">웹 상의 모든 샥즈 관련 뉴스·기사·콘텐츠를 한 화면에서 모니터링</p>'
    + '</section>'

    + '<section class="stats">'
    +   '<div class="stat"><span class="stat-num">' + items.length + '</span><span class="stat-lbl">총 클리핑</span></div>'
    +   '<div class="stat"><span class="stat-num">' + sourceCount + '</span><span class="stat-lbl">매체 수</span></div>'
    +   '<div class="stat"><span class="stat-num">' + (data.total || items.length) + '</span><span class="stat-lbl">필터 통과</span></div>'
    +   '<div class="stat"><span class="stat-num">' + droppedNote + '</span><span class="stat-lbl">노이즈 제외</span></div>'
    +   '<div class="stat"><span class="stat-num small">' + escapeHtml(fetchedLabel) + '</span><span class="stat-lbl">최근 수집</span></div>'
    + '</section>'

    + '<nav class="tabs">' + renderTabs(cat) + '</nav>'

    + '<div class="info-line">검색어: <strong>' + escapeHtml(data.query || '샥즈 코리아') + '</strong> · 채널: ' + escapeHtml(channelLine) + (data.strict ? ' · <span class="strict-on">정확도 필터 ON</span>' : '') + '</div>'

    + (items.length === 0
        ? '<div class="empty"><div class="empty-icon">▤</div><p>수집된 클리핑이 없습니다.</p></div>'
        : '<div class="layout">'
          + '<main class="main">'
          +   (cat === 'all'
              ? (renderHero(hero)
                + (subs.length ? '<div class="sub-grid">' + subs.map(renderSubCard).join('') + '</div>' : '')
                + '<div class="section-head"><h3>최신 클리핑</h3><span class="section-count" id="gridCount">' + rest.length + '건</span></div>'
                + '<div class="grid" id="grid">' + rest.map(renderCard).join('') + '</div>')
              : ('<div class="section-head"><h3>' + escapeHtml((CATEGORY_META[cat] || {label: cat}).label) + ' 클리핑</h3><span class="section-count" id="gridCount"></span></div>'
                + '<div class="grid" id="grid">' + items.map(renderCard).join('') + '</div>'))
          +   '<div id="emptyResult" class="empty" style="display:none"><div class="empty-icon">▤</div><p>해당 조건의 클리핑이 없습니다.</p></div>'
          + '</main>'
          + '<aside class="sidebar">'
          +   '<div class="widget"><h4>매체별 클리핑</h4><div class="src-list">' + renderSourceBars(items) + '</div></div>'
          +   '<div class="widget"><h4>트렌딩 키워드</h4><div class="tag-cloud">' + renderTagCloud(items) + '</div></div>'
          +   '<div class="widget"><h4>실시간 피드</h4><div class="live-feed">' + renderLiveFeed(items) + '</div></div>'
          + '</aside>'
        + '</div>')

    + '<footer class="footer">샥즈 코리아 매거진 · powered by Naver Search API · <a href="?format=json" target="_blank">JSON 보기</a></footer>'

    + '<script>' + MAGAZINE_JS + '</script>'
    + '</body></html>';
}

/* ───── 매거진 CSS (eulpeul 디자인 포팅, self-contained) ───── */
const MAGAZINE_CSS = '' +
':root{--bg:#0f1117;--bg2:#1a1d27;--card:#1e2132;--hover:#252940;--bd:#2a2e3f;--fg:#e8eaf0;--fg2:#8b90a0;--mute:#5a5f73;--blue:#4a7cff;--green:#34d399;--red:#f87171;--yellow:#fbbf24;--purple:#a78bfa;--cyan:#22d3ee;--r:10px;--rs:6px}' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Noto Sans KR","Inter",-apple-system,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;padding:24px;max-width:1400px;margin:0 auto}' +
'a{color:inherit;text-decoration:none}' +
'button{cursor:pointer;border:none;font-family:inherit}' +
/* topbar */
'.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--bd)}' +
'.brand{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:2px;color:var(--mute)}' +
'.brand-mark{font-size:14px;font-weight:900;color:var(--blue);letter-spacing:3px}' +
'.brand-divider{color:var(--bd)}' +
'.search-wrap{display:flex;gap:8px;align-items:center}' +
'#searchInput{background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:8px 14px;color:var(--fg);font-size:13px;width:240px;outline:none;transition:.2s}' +
'#searchInput:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(74,124,255,.15)}' +
'.refresh-btn{background:var(--card);border:1px solid var(--bd);color:var(--fg2);width:38px;height:38px;border-radius:var(--rs);font-size:18px;display:flex;align-items:center;justify-content:center;transition:.2s}' +
'.refresh-btn:hover{background:var(--hover);color:var(--fg)}' +
/* hero section header */
'.hero-section{margin-bottom:20px}' +
'.hero-section h1{font-size:24px;font-weight:900;letter-spacing:-.3px;margin-bottom:6px}' +
'.tagline{font-size:13px;color:var(--fg2)}' +
/* stats */
'.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;padding:18px;background:linear-gradient(135deg,rgba(74,124,255,.08),rgba(167,139,250,.05));border:1px solid var(--bd);border-radius:var(--r)}' +
'.stat{display:flex;flex-direction:column;gap:4px;padding:0 8px;border-right:1px solid var(--bd)}' +
'.stat:last-child{border-right:none}' +
'.stat-num{font-size:24px;font-weight:900;color:var(--fg);line-height:1.1}' +
'.stat-num.small{font-size:13px;font-weight:700}' +
'.stat-lbl{font-size:11px;color:var(--mute);letter-spacing:.5px;text-transform:uppercase}' +
/* tabs */
'.tabs{display:flex;gap:4px;margin-bottom:14px;overflow-x:auto;border-bottom:1px solid var(--bd)}' +
'.tab{background:transparent;color:var(--fg2);padding:10px 18px;font-size:13px;font-weight:600;border-bottom:2px solid transparent;white-space:nowrap;transition:.2s}' +
'.tab:hover{color:var(--fg)}' +
'.tab.active{color:var(--blue);border-bottom-color:var(--blue)}' +
/* info line */
'.info-line{font-size:12px;color:var(--fg2);margin-bottom:20px;padding:10px 14px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs)}' +
'.info-line strong{color:var(--fg)}' +
'.strict-on{color:var(--green);font-weight:700}' +
/* layout */
'.layout{display:grid;grid-template-columns:1fr 320px;gap:20px}' +
'.main{display:flex;flex-direction:column;gap:20px;min-width:0}' +
/* hero card */
'.hero{position:relative;display:grid;grid-template-columns:1.2fr 1fr;background:var(--card);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;cursor:pointer;transition:.2s;min-height:320px}' +
'.hero:hover{border-color:var(--blue);box-shadow:0 8px 32px rgba(74,124,255,.2);transform:translateY(-2px)}' +
'.hero-img{position:relative;background-size:cover;background-position:center;overflow:hidden}' +
'.hero-img::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,transparent 30%,rgba(0,0,0,.4) 100%)}' +
'.hero-cat{position:absolute;top:18px;left:18px;z-index:2}' +
'.watermark{position:absolute;bottom:16px;right:16px;font-size:38px;font-weight:900;color:rgba(255,255,255,.25);letter-spacing:4px;z-index:2}' +
'.hero-body{padding:32px 28px;display:flex;flex-direction:column;justify-content:center;gap:14px}' +
'.hero-title{font-size:24px;font-weight:900;line-height:1.3;color:var(--fg)}' +
'.hero-excerpt{font-size:14px;color:var(--fg2);line-height:1.7;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}' +
'.hero-foot{display:flex;align-items:center;gap:14px;padding-top:12px;border-top:1px solid var(--bd);font-size:12px;color:var(--mute)}' +
/* sub cards */
'.sub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}' +
'.sub-card{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;cursor:pointer;transition:.2s;display:flex;flex-direction:column}' +
'.sub-card:hover{border-color:var(--blue);transform:translateY(-2px);box-shadow:0 4px 24px rgba(0,0,0,.3)}' +
'.sub-img{height:140px;background-size:cover;background-position:center;position:relative}' +
'.sub-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,.5) 100%)}' +
'.sub-cat{position:absolute;top:10px;left:10px;z-index:2}' +
'.sub-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}' +
'.sub-title{font-size:15px;font-weight:700;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
'.sub-excerpt{font-size:12px;color:var(--fg2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}' +
'.sub-foot{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--mute);padding-top:8px;border-top:1px solid var(--bd)}' +
/* section head */
'.section-head{display:flex;align-items:baseline;gap:12px;padding:8px 0 4px;border-bottom:2px solid var(--blue)}' +
'.section-head h3{font-size:16px;font-weight:900;letter-spacing:-.3px}' +
'.section-count{font-size:12px;color:var(--mute)}' +
/* main grid */
'.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}' +
'.card{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;cursor:pointer;transition:.2s;display:flex;flex-direction:column}' +
'.card:hover{border-color:var(--blue);transform:translateY(-2px);box-shadow:0 2px 8px rgba(0,0,0,.2)}' +
'.card-img{height:110px;background-size:cover;background-position:center;position:relative}' +
'.card-cat{position:absolute;top:8px;left:8px;z-index:2}' +
'.card-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}' +
'.card-title{font-size:13.5px;font-weight:700;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
'.card-excerpt{font-size:11.5px;color:var(--fg2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}' +
'.card-foot{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:var(--mute);padding-top:6px}' +
/* shared chips */
'.cat-chip{display:inline-block;padding:3px 10px;border-radius:3px;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff}' +
'.src-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--fg)}' +
'.src-dot{display:inline-block;width:6px;height:6px;border-radius:50%}' +
'.meta-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
'.meta-dot{color:var(--mute);margin:0 4px}' +
'.meta-dim{font-size:12px;color:var(--mute)}' +
'.tags{font-size:11px}' +
/* sidebar */
'.sidebar{display:flex;flex-direction:column;gap:16px}' +
'.widget{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:16px 18px}' +
'.widget h4{font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--bd);letter-spacing:.3px}' +
'.src-list{display:flex;flex-direction:column;gap:8px}' +
'.src-row{display:flex;align-items:center;gap:8px;font-size:12px}' +
'.src-name{min-width:88px;font-weight:600;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.src-bar{flex:1;height:5px;background:var(--hover);border-radius:3px;overflow:hidden;display:block}' +
'.src-bar-fill{height:100%;border-radius:3px;display:block;transition:width .6s ease}' +
'.src-count{font-weight:700;color:var(--fg2);min-width:20px;text-align:right;font-size:11px}' +
'.tag-cloud{display:flex;flex-wrap:wrap;gap:6px}' +
'.tag{display:inline-block;padding:4px 10px;background:var(--hover);border-radius:12px;font-size:11px;color:var(--fg2);cursor:default;transition:.2s}' +
'.tag-hot{background:rgba(248,113,113,.15);color:var(--red);font-weight:600}' +
'.live-feed{display:flex;flex-direction:column;gap:10px;max-height:340px;overflow-y:auto}' +
'.feed-item{padding:10px 0;border-bottom:1px solid var(--bd);cursor:pointer;transition:.2s}' +
'.feed-item:last-child{border-bottom:none}' +
'.feed-item:hover .feed-title{color:var(--blue)}' +
'.feed-title{font-size:12.5px;font-weight:600;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
'.feed-meta{font-size:10.5px;color:var(--mute)}' +
'.empty{text-align:center;padding:60px 20px;color:var(--mute)}' +
'.empty-icon{font-size:48px;margin-bottom:12px;opacity:.4}' +
'.empty-mini{font-size:11px;color:var(--mute);text-align:center;padding:8px 0}' +
'.footer{margin-top:32px;padding-top:20px;border-top:1px solid var(--bd);text-align:center;font-size:11px;color:var(--mute)}' +
'.footer a{color:var(--blue)}' +
/* scrollbar */
'::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:var(--mute)}' +
/* responsive */
'@media (max-width:1100px){.layout{grid-template-columns:1fr}.stats{grid-template-columns:repeat(3,1fr)}.stats .stat:nth-child(3){border-right:none}.sub-grid{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(2,1fr)}}' +
'@media (max-width:680px){body{padding:16px}.topbar{flex-direction:column;align-items:flex-start}.stats{grid-template-columns:repeat(2,1fr)}.stats .stat{border-right:none}.hero{grid-template-columns:1fr;min-height:auto}.hero-img{height:180px}.hero-title{font-size:20px}.hero-body{padding:20px}.sub-grid{grid-template-columns:1fr}.grid{grid-template-columns:1fr}#searchInput{width:100%}}';

/* ───── 클라이언트 JS (탭/검색 인터랙션) ───── */
const MAGAZINE_JS = '' +
'(function(){' +
'  function getQueryParam(k){var u=new URLSearchParams(location.search);return u.get(k)||"";}' +
'  function setQueryParam(k,v){var u=new URLSearchParams(location.search);if(v){u.set(k,v);}else{u.delete(k);}var s=u.toString();location.search=s?("?"+s):"";}' +
'  // 탭 클릭 → cat 쿼리 변경하여 새 페이지 로드' +
'  document.querySelectorAll(".tab").forEach(function(b){' +
'    b.addEventListener("click",function(){setQueryParam("cat",b.dataset.cat==="all"?"":b.dataset.cat);});' +
'  });' +
'  // 검색은 클라이언트 사이드 즉시 필터링 (이미 로드된 카드들 대상)' +
'  var search=document.getElementById("searchInput");' +
'  function applySearch(){' +
'    var q=(search.value||"").trim().toLowerCase();' +
'    var cards=document.querySelectorAll(".hero,.sub-card,.card");' +
'    var visible=0;' +
'    cards.forEach(function(c){' +
'      var t=c.innerText.toLowerCase();' +
'      var show=!q||t.indexOf(q)!==-1;' +
'      c.style.display=show?"":"none";' +
'      if(show)visible++;' +
'    });' +
'    var gc=document.getElementById("gridCount");' +
'    if(gc&&q)gc.textContent="필터 결과 "+visible+"건";' +
'    var er=document.getElementById("emptyResult");' +
'    if(er)er.style.display=(visible===0)?"block":"none";' +
'  }' +
'  if(search){' +
'    search.addEventListener("input",applySearch);' +
'    search.addEventListener("keydown",function(e){if(e.key==="Enter")applySearch();});' +
'    if(search.value)applySearch();' +
'  }' +
'})();';

/* ───── 디버그/관리 (Apps Script 에디터에서 직접 실행) ───── */

function _debug() {
  const out = doGet({ parameter: { query: '샥즈 코리아', display: 5, channels: 'news,blog,cafe', strict: 'true', format: 'json' } });
  Logger.log(out.getContent().slice(0, 4000));
}

function _debugHtml() {
  const out = doGet({ parameter: { query: '샥즈 코리아', display: 5, channels: 'news,blog,cafe', strict: 'true' } });
  Logger.log(out.getContent().slice(0, 4000));
}
