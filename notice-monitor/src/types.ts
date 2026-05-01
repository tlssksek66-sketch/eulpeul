export interface NoticeRaw {
  date: string;          // YYYY-MM-DD
  title: string;
  noticeId: string;      // "31108"
  url: string;
  category: '검색광고' | '디스플레이광고' | '일반' | '기타';
}

export interface NoticeClassified extends NoticeRaw {
  shokzImpact: '직접' | '간접' | '무관';
  salesValue: '높음' | '중간' | '낮음';
  salesCategories: string[];   // ['디지털가전', '패션', ...]
  summary: string;             // 한 줄 50자 이내
  fullText?: string;           // 영업가치 높음만 채워짐
  classifiedAt: string;        // ISO datetime
  firstSeen: string;           // ISO datetime
}

export interface Env {
  NOTICE_KV: KVNamespace;
  PERPLEXITY_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_SHEETS_ID: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  SLACK_BOT_TOKEN: string;
  SLACK_CHANNEL_ID: string;
  ADMIN_AUTH_TOKEN: string;
}
