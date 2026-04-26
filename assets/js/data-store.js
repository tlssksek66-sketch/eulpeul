/**
 * SHOKZ Korea Clipping Magazine - Data Store
 * assets/data/clippings.json 을 fetch 해서 통계 헬퍼를 제공
 */
const MagazineData = {
    meta: {
        brand: 'SHOKZ',
        region: 'KOREA',
        searchKeyword: '샥즈 코리아',
        collectedAt: null,
        totalClippings: 0,
        filterPassed: 0,
        noiseFiltered: 0,
        accuracyFilter: true
    },

    channels: [
        { key: 'news',        label: '뉴스',   color: '#4a7cff', collected: 0,  quota: 20 },
        { key: 'blog',        label: '블로그', color: '#34d399', collected: 0,  quota: 20 },
        { key: 'cafearticle', label: '카페',   color: '#fb923c', collected: 0,  quota: 20 }
    ],

    categories: [
        { key: 'all',       label: '전체' },
        { key: 'product',   label: '신제품' },
        { key: 'review',    label: '리뷰' },
        { key: 'tech',      label: '기술' },
        { key: 'sports',    label: '스포츠' },
        { key: 'marketing', label: '마케팅' },
        { key: 'press',     label: '보도' },
        { key: 'community', label: '커뮤니티' }
    ],

    categoryColors: {
        product:   '#4a7cff',
        review:    '#34d399',
        tech:      '#22d3ee',
        sports:    '#fbbf24',
        marketing: '#a78bfa',
        press:     '#f87171',
        community: '#fb923c'
    },

    sentimentColors: {
        positive: '#34d399',
        neutral:  '#6b7280',
        negative: '#f87171'
    },

    clippings: [],
    indexByKeyword: null,
    loaded: false,
    dataUrl: 'assets/data/clippings.json',

    /**
     * JSON 파일 로드. categories/categoryColors 도 JSON에 있으면 덮어씀.
     */
    async load(url) {
        const target = url || this.dataUrl;
        try {
            const res = await fetch(target, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            this.meta = { ...this.meta, ...(data.meta || {}) };
            if (Array.isArray(data.channels)) {
                this.channels = data.channels.map(c => {
                    const base = this.channels.find(x => x.key === c.key) || {};
                    return { ...base, ...c };
                });
            }
            if (Array.isArray(data.categories)) this.categories = data.categories;
            if (data.categoryColors && typeof data.categoryColors === 'object') {
                this.categoryColors = data.categoryColors;
            }
            this.indexByKeyword = Array.isArray(data.indexByKeyword) ? data.indexByKeyword : null;
            this.clippings = Array.isArray(data.clippings) ? data.clippings : [];
            this.loaded = true;
        } catch (err) {
            console.error('[MagazineData] load failed:', err);
            this.clippings = [];
            this.loaded = true;
        }
    },

    /**
     * 카테고리 또는 검색어로 필터링 (뉴스만 옵션 지원)
     */
    filter(category, query, opts = {}) {
        const q = (query || '').trim().toLowerCase();
        const onlyNews = opts.onlyNews === true;
        return this.clippings.filter(c => {
            if (onlyNews && c.channel !== 'news') return false;
            const catOk = !category || category === 'all' || c.category === category;
            if (!catOk) return false;
            if (!q) return true;
            return (c.title + ' ' + c.summary + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(q);
        });
    },

    /**
     * 일별 클리핑 추이 (최근 14일, KST 기준 collectedAt 의 날짜를 today 로)
     */
    getDailyTrend() {
        const dayMap = {};
        this.clippings.forEach(c => {
            const day = (c.date || '').slice(0, 10);
            if (day) dayMap[day] = (dayMap[day] || 0) + 1;
        });
        const labels = [];
        const counts = [];
        const today = this._todayKST();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
            counts.push(dayMap[key] || 0);
        }
        return { labels, counts };
    },

    _todayKST() {
        const m = (this.meta.collectedAt || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },

    getChannelMix() {
        const counts = {};
        this.clippings.forEach(c => { counts[c.channel] = (counts[c.channel] || 0) + 1; });
        return this.channels.map(ch => ({ label: ch.label, value: counts[ch.key] || 0, color: ch.color }));
    },

    getCategoryMix() {
        const counts = {};
        this.clippings.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
        return this.categories
            .filter(cat => cat.key !== 'all' && (counts[cat.key] || 0) > 0)
            .map(cat => ({
                key: cat.key,
                label: cat.label,
                value: counts[cat.key],
                color: this.categoryColors[cat.key] || '#6b7280'
            }));
    },

    getSentimentMix(filterFn) {
        const list = filterFn ? this.clippings.filter(filterFn) : this.clippings;
        const counts = { positive: 0, neutral: 0, negative: 0 };
        list.forEach(c => { counts[c.sentiment] = (counts[c.sentiment] || 0) + 1; });
        const total = list.length || 1;
        return [
            { key: 'positive', label: '긍정', value: counts.positive, color: this.sentimentColors.positive, pct: Math.round(counts.positive / total * 100) },
            { key: 'neutral',  label: '중립', value: counts.neutral,  color: this.sentimentColors.neutral,  pct: Math.round(counts.neutral  / total * 100) },
            { key: 'negative', label: '부정', value: counts.negative, color: this.sentimentColors.negative, pct: Math.round(counts.negative / total * 100) }
        ];
    },

    getMediaTop(limit = 10, filterFn) {
        const list = filterFn ? this.clippings.filter(filterFn) : this.clippings;
        const counts = {};
        list.forEach(c => { counts[c.media] = (counts[c.media] || 0) + 1; });
        return Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    },

    getKeywordTop(limit = 10, filterFn) {
        const list = filterFn ? this.clippings.filter(filterFn) : this.clippings;
        const exclude = new Set(['샥즈', 'SHOKZ', 'OpenRun', 'OpenSwim', '커뮤니티', '샥즈코리아', 'SHOKZ KOREA']);
        const counts = {};
        list.forEach(c => {
            (c.tags || []).forEach(tag => {
                if (exclude.has(tag)) return;
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    },

    getMediaCount() {
        return new Set(this.clippings.map(c => c.media)).size;
    },

    getReactionsSummary() {
        const isReaction = (c) => c.channel === 'blog' || c.channel === 'cafearticle';
        const reactions = this.clippings.filter(isReaction);
        const blogCount = reactions.filter(c => c.channel === 'blog').length;
        const cafeCount = reactions.filter(c => c.channel === 'cafearticle').length;
        return {
            total: reactions.length,
            blog: blogCount,
            cafe: cafeCount,
            sentiment: this.getSentimentMix(isReaction),
            keywords: this.getKeywordTop(10, isReaction),
            media: this.getMediaTop(8, isReaction)
        };
    }
};
