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
 *       ?query=샥즈 코리아           (검색어, 기본 "샥즈 코리아")
 *       &display=20                  (각 채널당 1~100건)
 *       &channels=news,blog,cafe     (조합 가능)
 *       &sort=date                   ('date' | 'sim', 기본 date)
 *
 *  응답 스키마(요약):
 *  {
 *    query, fetchedAt, total,
 *    items: [{ id, title, excerpt, url, date, channel,
 *              category, source, sourceColor, tags,
 *              sentiment, bloggerName?, cafeName? }],
 *    counts: { news, blog, cafearticle },
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
  'zdnet.co.kr':         { name: '지디넷코리아',   color: '#0066ff' },
  'it.chosun.com':       { name: 'IT조선',        color: '#e60012' },
  'biz.chosun.com':      { name: '조선비즈',      color: '#0033a0' },
  'chosun.com':          { name: '조선일보',      color: '#0033a0' },
  'donga.com':           { name: '동아일보',      color: '#003478' },
  'sports.donga.com':    { name: '스포츠동아',    color: '#d32f2f' },
  'mk.co.kr':            { name: '매일경제',      color: '#cc0000' },
  'edaily.co.kr':        { name: '이데일리',      color: '#ff5722' },
  'hani.co.kr':          { name: '한겨레',        color: '#005bac' },
  'etnews.com':          { name: '전자신문',      color: '#1976d2' },
  'ddaily.co.kr':        { name: '디지털데일리',  color: '#1e88e5' },
  'health.chosun.com':   { name: '헬스조선',      color: '#28a745' },
  'sports.khan.co.kr':   { name: '스포츠경향',    color: '#ff6600' },
  'fashionbiz.co.kr':    { name: '패션비즈',      color: '#9c27b0' },
  'thegear.net':         { name: '더기어',        color: '#212121' },
  'gqkorea.co.kr':       { name: 'GQ 코리아',     color: '#000000' },
  'runnersworld.co.kr':  { name: '러너스월드',    color: '#ff5252' },
  'bike.chosun.com':     { name: '바이크조선',    color: '#388e3c' },
  'womansense.co.kr':    { name: '우먼센스',      color: '#e91e63' }
};

const SHOKZ_KEYWORDS = [
  'OpenRun', 'OpenFit', 'OpenSwim', 'OpenMove', 'OpenComm', 'OpenGolf',
  '골전도', '러닝', '사이클', '수영', '골프', '마라톤', '트라이애슬론'
];

/**
 * 메인 엔드포인트
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const query = (params.query || '샥즈 코리아').trim();
  const display = clampInt(params.display, 1, 100, 20);
  const sort = (params.sort === 'sim') ? 'sim' : 'date';
  const channelsRaw = (params.channels || 'news,blog,cafe').split(',')
    .map(s => s.trim().toLowerCase()).filter(Boolean);
  const channels = channelsRaw
    .map(c => CHANNEL_ALIAS[c])
    .filter(Boolean);

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('NAVER_CLIENT_ID');
  const clientSecret = props.getProperty('NAVER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return jsonOut({
      error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 스크립트 속성이 설정되지 않았습니다. ' +
             '프로젝트 설정 → 스크립트 속성에 키를 추가하세요.'
    }, 500);
  }

  const all = [];
  const counts = {};
  const errors = {};

  channels.forEach(ch => {
    try {
      const items = fetchChannel(ch, query, display, sort, clientId, clientSecret);
      counts[ch] = items.length;
      items.forEach(it => all.push(normalize(it, ch)));
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
  unique.forEach((a, i) => { a.id = `n${stamp}_${i}`; });

  return jsonOut({
    query: query,
    fetchedAt: new Date().toISOString(),
    total: unique.length,
    counts: counts,
    items: unique,
    errors: Object.keys(errors).length ? errors : undefined
  });
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

/* ───── 디버그/관리 (Apps Script 에디터에서 직접 실행) ───── */

function _debug() {
  const out = doGet({ parameter: { query: '샥즈 코리아', display: 5, channels: 'news,blog,cafe' } });
  Logger.log(out.getContent().slice(0, 4000));
}
