/**
 * AdWarehouse - Tier 2 광고 fact 데이터 웨어하우스 (IndexedDB)
 *
 * 책임:
 *  - 일자×디멘션 단위 row-level fact를 영속 저장
 *  - 기간/필터 쿼리, 집계, 회귀 분석에 필요한 데이터 추출
 *  - localStorage(Tier 1)는 요약/현재 KPI, 본 모듈은 다차원 시계열 fact를 담당
 *
 * 스키마 (object stores):
 *  sa_facts / gfa_facts:
 *    { id (autoIncrement), date 'YYYY-MM-DD', source, accountId,
 *      campaignId, campaignName, dim {임의 키:값}, kpi {impressions,clicks,cost,conversions,revenue} }
 *    indexes: date / campaignId / [date, campaignId]
 *  imports:
 *    { id, at ISO, source, kind 'detail'|'summary', rows, note }
 *    indexes: at / source
 *
 * 용량 가정:
 *  - 브라우저 IndexedDB quota 50MB+ (요청 시 GB)
 *  - row당 평균 ~250B → 500K rows ≈ 125MB (1년치 다차원 리포트 포섭 가능)
 */
const AdWarehouse = {
    DB_NAME: 'eulpeul_warehouse',
    DB_VERSION: 1,
    STORES: {
        SA: 'sa_facts',
        GFA: 'gfa_facts',
        IMPORTS: 'imports'
    },
    _db: null,

    /** DB 오픈 + 마이그레이션 */
    init() {
        if (this._db) return Promise.resolve(this._db);
        if (!('indexedDB' in window)) {
            return Promise.reject(new Error('IndexedDB not available'));
        }
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                [this.STORES.SA, this.STORES.GFA].forEach((name) => {
                    if (!db.objectStoreNames.contains(name)) {
                        const s = db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
                        s.createIndex('date', 'date', { unique: false });
                        s.createIndex('campaignId', 'campaignId', { unique: false });
                        s.createIndex('date_campaign', ['date', 'campaignId'], { unique: false });
                    }
                });
                if (!db.objectStoreNames.contains(this.STORES.IMPORTS)) {
                    const s = db.createObjectStore(this.STORES.IMPORTS, { keyPath: 'id', autoIncrement: true });
                    s.createIndex('at', 'at', { unique: false });
                    s.createIndex('source', 'source', { unique: false });
                }
            };
            req.onsuccess = () => { this._db = req.result; resolve(this._db); };
            req.onerror = () => reject(req.error);
        });
    },

    /** 소스 ID → store 이름 */
    storeFor(source) {
        if (source === 'naver_sa' || source === 'sa') return this.STORES.SA;
        if (source === 'naver_gfa' || source === 'gfa') return this.STORES.GFA;
        throw new Error('Unknown source: ' + source);
    },

    /** 배치 적재 */
    async putBatch(source, rows) {
        if (!rows || rows.length === 0) return { count: 0 };
        const db = await this.init();
        const storeName = this.storeFor(source);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            let n = 0;
            rows.forEach((r) => {
                const row = Object.assign({}, r);
                delete row.id;
                store.add(row);
                n++;
            });
            tx.oncomplete = () => resolve({ count: n });
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    /**
     * 쿼리.
     *   { source, from, to, where(row)→bool, groupBy(row)→string|null, orderBy {key,dir} | function, limit }
     * groupBy가 있으면 KPI 합산 후 반환, 없으면 raw row.
     */
    async query(opts) {
        const { source, from, to, where, groupBy, orderBy, limit } = opts;
        const db = await this.init();
        const storeName = this.storeFor(source);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const useDateIndex = !!(from || to);
            const range = (from && to) ? IDBKeyRange.bound(from, to)
                : from ? IDBKeyRange.lowerBound(from)
                : to ? IDBKeyRange.upperBound(to)
                : null;
            const cursorReq = useDateIndex ? store.index('date').openCursor(range) : store.openCursor();
            const results = [];
            cursorReq.onsuccess = (e) => {
                const c = e.target.result;
                if (c) {
                    const v = c.value;
                    if (!where || where(v)) results.push(v);
                    c.continue();
                } else {
                    let out = results;
                    if (groupBy) out = this._aggregate(out, groupBy);
                    if (orderBy) out = this._order(out, orderBy);
                    if (limit) out = out.slice(0, limit);
                    resolve(out);
                }
            };
            cursorReq.onerror = () => reject(cursorReq.error);
        });
    },

    _aggregate(rows, groupBy) {
        const buckets = new Map();
        rows.forEach((r) => {
            const k = groupBy(r);
            if (k == null) return;
            if (!buckets.has(k)) {
                buckets.set(k, {
                    key: k,
                    kpi: { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 },
                    count: 0
                });
            }
            const b = buckets.get(k);
            b.kpi.impressions += r.kpi.impressions || 0;
            b.kpi.clicks += r.kpi.clicks || 0;
            b.kpi.cost += r.kpi.cost || 0;
            b.kpi.conversions += r.kpi.conversions || 0;
            b.kpi.revenue += r.kpi.revenue || 0;
            b.count++;
        });
        return Array.from(buckets.values());
    },

    _order(rows, orderBy) {
        if (typeof orderBy === 'function') return rows.slice().sort(orderBy);
        const keyFn = (r) => orderBy.key.split('.').reduce((o, k) => (o == null ? null : o[k]), r);
        return rows.slice().sort((a, b) => {
            const av = keyFn(a), bv = keyFn(b);
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = (typeof av === 'number' && typeof bv === 'number')
                ? av - bv
                : String(av).localeCompare(String(bv));
            return orderBy.dir === 'desc' ? -cmp : cmp;
        });
    },

    /** row 카운트 */
    async count(source) {
        const db = await this.init();
        const storeName = this.storeFor(source);
        return new Promise((resolve, reject) => {
            const r = db.transaction(storeName, 'readonly').objectStore(storeName).count();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    },

    /** 전체 비우기 */
    async clear(source) {
        const db = await this.init();
        const storeName = this.storeFor(source);
        return new Promise((resolve, reject) => {
            const r = db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
            r.onsuccess = () => resolve();
            r.onerror = () => reject(r.error);
        });
    },

    /** 저장 quota / usage */
    async estimate() {
        if (navigator.storage && navigator.storage.estimate) {
            try { return await navigator.storage.estimate(); }
            catch (e) { return { usage: 0, quota: 0 }; }
        }
        return { usage: 0, quota: 0 };
    },

    /** 적재 이력 기록 */
    async recordImport(meta) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const r = db.transaction(this.STORES.IMPORTS, 'readwrite')
                .objectStore(this.STORES.IMPORTS)
                .add(Object.assign({ at: new Date().toISOString() }, meta));
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    },

    /** 적재 이력 조회 (최신순) */
    async listImports(limit) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORES.IMPORTS, 'readonly');
            const idx = tx.objectStore(this.STORES.IMPORTS).index('at');
            const out = [];
            const cursorReq = idx.openCursor(null, 'prev');
            cursorReq.onsuccess = (e) => {
                const c = e.target.result;
                if (c && (limit == null || out.length < limit)) {
                    out.push(c.value);
                    c.continue();
                } else {
                    resolve(out);
                }
            };
            cursorReq.onerror = () => reject(cursorReq.error);
        });
    },

    // =====================================================
    // 다차원 CSV 파서 (date + dimensions + metrics)
    // =====================================================
    _parseCSVLine(line) {
        const out = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQ) {
                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (ch === '"') inQ = false;
                else cur += ch;
            } else {
                if (ch === '"') inQ = true;
                else if (ch === ',') { out.push(cur); cur = ''; }
                else cur += ch;
            }
        }
        out.push(cur);
        return out;
    },

    _toNumber(v) {
        if (v == null) return 0;
        const s = String(v).trim().replace(/[원₩,\s]/g, '').replace(/%$/, '');
        if (!s || s === '-') return 0;
        const n = Number(s);
        return isFinite(n) ? n : 0;
    },

    /** 표준 metric 컬럼 키 셋 (이외 컬럼은 dim으로 분류) */
    _metricKeys: new Set(['impressions', 'clicks', 'cost', 'conversions', 'revenue']),

    /** 한/영 헤더를 표준 키로 alias 매핑 */
    _headerAlias: {
        '일자': 'date', '날짜': 'date', 'date': 'date', 'day': 'date',
        '캠페인명': 'campaignName', '캠페인': 'campaignName', 'campaign': 'campaignName', 'campaign name': 'campaignName',
        '캠페인id': 'campaignId', 'campaign id': 'campaignId',
        '광고그룹명': 'dim.adgroup', '광고그룹': 'dim.adgroup', 'adgroup': 'dim.adgroup',
        '키워드': 'dim.keyword', 'keyword': 'dim.keyword',
        '매치타입': 'dim.matchType', '매치': 'dim.matchType', 'match type': 'dim.matchType',
        '디바이스': 'dim.device', 'device': 'dim.device',
        '시간': 'dim.hour', '시간대': 'dim.hour', 'hour': 'dim.hour',
        '지역': 'dim.region', '시도': 'dim.region', 'region': 'dim.region',
        '성별': 'dim.gender', 'gender': 'dim.gender',
        '연령': 'dim.age', '연령대': 'dim.age', 'age': 'dim.age',
        '소재명': 'dim.creative', '소재': 'dim.creative', 'creative': 'dim.creative',
        '소재유형': 'dim.format', '소재 유형': 'dim.format', 'format': 'dim.format',
        '게재면': 'dim.placement', 'placement': 'dim.placement',
        '오디언스': 'dim.audience', 'audience': 'dim.audience',
        '캠페인목적': 'dim.objective', '캠페인 목적': 'dim.objective', 'objective': 'dim.objective',
        '노출수': 'impressions', '노출': 'impressions', 'impressions': 'impressions', 'imp': 'impressions',
        '클릭수': 'clicks', '클릭': 'clicks', 'clicks': 'clicks',
        '비용': 'cost', '총비용': 'cost', '광고비': 'cost', 'cost': 'cost', 'spend': 'cost',
        '전환수': 'conversions', '전환': 'conversions', 'conversions': 'conversions', 'conv': 'conversions',
        '전환매출': 'revenue', '전환매출액': 'revenue', '매출': 'revenue', 'revenue': 'revenue', 'sales': 'revenue'
    },

    /**
     * 다차원 CSV → fact rows.
     * 필수: date, campaignName(또는 campaignId)
     * dim.* 컬럼은 모두 dim 객체로 모음, 표준 metric은 kpi에.
     * @returns { rows, errors }
     */
    parseDetailCSV(text, source) {
        if (!text) return { rows: [], errors: ['빈 입력'] };
        const clean = text.replace(/^﻿/, '').trim();
        const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return { rows: [], errors: ['헤더+데이터 행이 필요합니다'] };

        const headerRaw = this._parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
        const headers = headerRaw.map((h) => this._headerAlias[h] || null);
        if (!headers.includes('date')) return { rows: [], errors: ['필수 컬럼 누락: 일자(date)'] };
        if (!headers.includes('campaignName') && !headers.includes('campaignId')) {
            return { rows: [], errors: ['필수 컬럼 누락: 캠페인명 또는 캠페인id'] };
        }

        const rows = [];
        const errors = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = this._parseCSVLine(lines[i]);
            const row = {
                source: source,
                accountId: source === 'naver_sa' ? 'sa-acct-1' : 'gfa-acct-1',
                date: '',
                campaignId: '',
                campaignName: '',
                dim: {},
                kpi: { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
            };
            headers.forEach((key, idx) => {
                if (!key) return;
                let v = (cells[idx] != null) ? cells[idx] : '';
                if (typeof v === 'string') v = v.trim();
                if (key === 'date') row.date = this._normalizeDate(v);
                else if (key === 'campaignName') row.campaignName = v;
                else if (key === 'campaignId') row.campaignId = v;
                else if (key.startsWith('dim.')) row.dim[key.slice(4)] = v;
                else if (this._metricKeys.has(key)) row.kpi[key] = this._toNumber(v);
            });
            if (!row.date) { errors.push('row ' + i + ': 잘못된 일자'); continue; }
            if (!row.campaignId && row.campaignName) row.campaignId = this._slugify(row.campaignName);
            rows.push(row);
        }

        return { rows, errors };
    },

    /** 'YYYY-MM-DD' / 'YYYY/MM/DD' / 'YYYYMMDD' 정규화 → 'YYYY-MM-DD' */
    _normalizeDate(s) {
        if (!s) return '';
        const t = String(s).trim();
        let m;
        if ((m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/))) {
            return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
        }
        if ((m = t.match(/^(\d{4})(\d{2})(\d{2})$/))) {
            return m[1] + '-' + m[2] + '-' + m[3];
        }
        const d = new Date(t);
        if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
        }
        return '';
    },

    _slugify(s) {
        return String(s).toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    },

    // =====================================================
    // 단순 선형 회귀
    //   y = slope * x + intercept,  R² 함께 반환
    // =====================================================
    linearRegression(points) {
        const n = points.length;
        if (n < 2) return null;
        let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < n; i++) {
            const x = points[i].x, y = points[i].y;
            sx += x; sy += y; sxy += x * y; sxx += x * x; syy += y * y;
        }
        const xbar = sx / n, ybar = sy / n;
        const den = sxx - sx * xbar;
        if (den === 0) return null;
        const slope = (sxy - sx * ybar) / den;
        const intercept = ybar - slope * xbar;
        const ssTot = syy - sy * ybar;
        let ssRes = 0;
        for (let i = 0; i < n; i++) {
            const yhat = intercept + slope * points[i].x;
            ssRes += (points[i].y - yhat) * (points[i].y - yhat);
        }
        const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
        return { slope, intercept, r2, n, xbar, ybar };
    },

    // =====================================================
    // 데모 fact 생성기 (계절성 + DOW + 노이즈, ~1년치)
    // =====================================================
    /**
     * @param {Object} opts { days = 365, sa = true, gfa = true, seed }
     * @returns { sa: rows, gfa: rows }
     */
    generateDemoFacts(opts) {
        opts = opts || {};
        const days = opts.days || 365;
        const seed = opts.seed != null ? opts.seed : Date.now() & 0xffff;
        const rng = this._mulberry32(seed);

        const SA_CAMPAIGNS = [
            { id: 'sa-c-1', name: '브랜드 검색 - 핵심 KW', product: '파워링크', baseCost: 1040000, baseRoas: 13.2 },
            { id: 'sa-c-2', name: '키워드 - 신규 유입', product: '파워링크', baseCost: 1947000, baseRoas: 4.9 },
            { id: 'sa-c-3', name: '쇼핑검색 - 카탈로그', product: '쇼핑검색', baseCost: 827000, baseRoas: 7.9 }
        ];
        const SA_DIMS = {
            keyword: ['샥즈 공식', '오픈이어 이어폰', '골전도 이어폰 추천', '러닝 이어폰', '사평 키마카레', '대구 카레 맛집'],
            matchType: ['구문', '확장'],
            device: ['PC', 'MOBILE'],
            region: ['서울', '경기', '부산', '대구', '기타']
        };
        const GFA_CAMPAIGNS = [
            { id: 'gfa-c-1', name: 'GFA - 사이트 트래픽 확장', objective: '트래픽', baseCost: 473000, baseRoas: 3.4 },
            { id: 'gfa-c-2', name: 'GFA - 구매 전환 리타겟', objective: '전환', baseCost: 607000, baseRoas: 8.0 },
            { id: 'gfa-c-3', name: 'GFA - 시즌 프로모션 노출', objective: '쇼핑프로모션', baseCost: 413000, baseRoas: 6.6 },
            { id: 'gfa-c-4', name: 'GFA - ADVoost 자동최적화', objective: 'ADVoost쇼핑', baseCost: 760000, baseRoas: 7.4 },
            { id: 'gfa-c-5', name: 'GFA - 카탈로그 다이내믹', objective: '카탈로그', baseCost: 327000, baseRoas: 4.3 }
        ];
        const GFA_DIMS = {
            format: ['IMAGE', 'VIDEO', 'DYNAMIC'],
            device: ['PC', 'MOBILE'],
            placement: ['네이버 메인', '뉴스', '쇼핑', '밴드']
        };

        const today = new Date();
        const sa = [], gfa = [];

        for (let d = days - 1; d >= 0; d--) {
            const day = new Date(today.getTime() - d * 86400000);
            const date = day.toISOString().slice(0, 10);
            const dow = day.getDay();
            const month = day.getMonth();
            const dowMul = [0.85, 1.05, 1.10, 1.10, 1.05, 0.95, 0.80][dow];
            const seasonMul = 1 + 0.18 * Math.sin(((month + 1) / 12) * 2 * Math.PI - Math.PI / 2);

            if (opts.sa !== false) {
                SA_CAMPAIGNS.forEach((c) => {
                    SA_DIMS.keyword.forEach((kw) => {
                        const dev = SA_DIMS.device[Math.floor(rng() * SA_DIMS.device.length)];
                        const region = SA_DIMS.region[Math.floor(rng() * SA_DIMS.region.length)];
                        const noise = 0.7 + rng() * 0.6;
                        const cost = Math.round(c.baseCost * dowMul * seasonMul * noise / 6);
                        const ctr = 0.025 + rng() * 0.02;
                        const cpc = 600 + rng() * 700;
                        const clicks = Math.max(0, Math.round(cost / cpc));
                        const impressions = Math.max(0, Math.round(clicks / ctr));
                        const cvr = 0.03 + rng() * 0.05;
                        const conversions = Math.max(0, Math.round(clicks * cvr));
                        const revenue = Math.max(0, Math.round(cost * c.baseRoas * (0.85 + rng() * 0.3)));
                        sa.push({
                            source: 'naver_sa', accountId: 'sa-acct-1',
                            date, campaignId: c.id, campaignName: c.name,
                            dim: { product: c.product, keyword: kw, matchType: SA_DIMS.matchType[rng() < 0.6 ? 1 : 0], device: dev, region: region },
                            kpi: { impressions, clicks, cost, conversions, revenue }
                        });
                    });
                });
            }

            if (opts.gfa !== false) {
                GFA_CAMPAIGNS.forEach((c) => {
                    GFA_DIMS.format.forEach((fmt) => {
                        const dev = GFA_DIMS.device[Math.floor(rng() * GFA_DIMS.device.length)];
                        const place = GFA_DIMS.placement[Math.floor(rng() * GFA_DIMS.placement.length)];
                        const noise = 0.6 + rng() * 0.7;
                        const cost = Math.round(c.baseCost * dowMul * seasonMul * noise / 3);
                        const ctr = 0.005 + rng() * 0.015;
                        const cpc = 350 + rng() * 500;
                        const clicks = Math.max(0, Math.round(cost / cpc));
                        const impressions = Math.max(0, Math.round(clicks / ctr));
                        const cvr = 0.012 + rng() * 0.03;
                        const conversions = Math.max(0, Math.round(clicks * cvr));
                        const revenue = Math.max(0, Math.round(cost * c.baseRoas * (0.8 + rng() * 0.4)));
                        gfa.push({
                            source: 'naver_gfa', accountId: 'gfa-acct-1',
                            date, campaignId: c.id, campaignName: c.name,
                            dim: { objective: c.objective, format: fmt, device: dev, placement: place },
                            kpi: { impressions, clicks, cost, conversions, revenue }
                        });
                    });
                });
            }
        }
        return { sa, gfa };
    },

    /** 결정성 RNG (mulberry32) */
    _mulberry32(seed) {
        let t = seed >>> 0;
        return function () {
            t |= 0; t = (t + 0x6D2B79F5) | 0;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }
};
