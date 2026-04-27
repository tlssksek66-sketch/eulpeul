/**
 * Commerce Magazine - Application
 * 플랫폼·이커머스 동향 페이지 전용
 */
const CommerceApp = {
    state: { category: 'all', query: '' },
    refs: {},

    async init() {
        this.refs = {
            kpiTotal: document.getElementById('kpiTotal'),
            kpiMedia: document.getElementById('kpiMedia'),
            kpiKeywords: document.getElementById('kpiKeywords'),
            kpiNoise: document.getElementById('kpiNoise'),
            kpiTime: document.getElementById('kpiTime'),
            tabs: document.getElementById('tabs'),
            filterStrip: document.getElementById('filterStrip'),
            searchInput: document.getElementById('searchInput'),
            refreshBtn: document.getElementById('refreshBtn'),
            clippingList: document.getElementById('clippingList'),
            clippingCount: document.getElementById('clippingCount'),
            clippingSub: document.getElementById('clippingSub'),
            keywordIndex: document.getElementById('keywordIndex'),
            pageTitle: document.getElementById('pageTitle'),
            pageSub: document.getElementById('pageSub')
        };

        // commerce.json 로드
        await MagazineData.load('assets/data/commerce.json');
        this.renderAll();

        this.refs.searchInput.addEventListener('input', (e) => {
            this.state.query = e.target.value;
            this.renderClippings();
        });
        this.refs.refreshBtn.addEventListener('click', () => this.refresh());
        window.addEventListener('resize', this.debounce(() => this.renderCharts(), 200));
    },

    async refresh() {
        this.refs.refreshBtn.classList.add('spin');
        await MagazineData.load('assets/data/commerce.json');
        setTimeout(() => {
            this.refs.refreshBtn.classList.remove('spin');
            this.renderAll();
        }, 300);
    },

    renderAll() {
        this.renderHeader();
        this.renderKPI();
        this.renderFilterStrip();
        this.renderTabs();
        this.renderCharts();
        this.renderKeywordIndex();
        this.renderClippings();
    },

    debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
    },

    renderHeader() {
        const m = MagazineData.meta;
        if (m.title) this.refs.pageTitle.textContent = m.title;
        if (m.subtitle) this.refs.pageSub.textContent = m.subtitle;
    },

    renderKPI() {
        const m = MagazineData.meta;
        this.refs.kpiTotal.textContent = m.totalClippings || MagazineData.clippings.length;
        this.refs.kpiMedia.textContent = MagazineData.getMediaCount();
        this.refs.kpiKeywords.textContent = (m.keywords || []).length;
        this.refs.kpiNoise.textContent = m.noiseFiltered || 0;
        this.refs.kpiTime.textContent = m.collectedAt ? this.formatCollectTime(m.collectedAt) : '--';
    },

    formatCollectTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '--';
        const ampm = d.getHours() < 12 ? '오전' : '오후';
        const hh = d.getHours() % 12 || 12;
        return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${hh}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    },

    renderTabs() {
        this.refs.tabs.innerHTML = '';
        MagazineData.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (cat.key === this.state.category ? ' active' : '');
            btn.textContent = cat.label;
            btn.dataset.key = cat.key;
            btn.addEventListener('click', () => {
                this.state.category = cat.key;
                this.renderTabs();
                this.renderClippings();
            });
            this.refs.tabs.appendChild(btn);
        });
    },

    renderFilterStrip() {
        const m = MagazineData.meta;
        const kws = (m.keywords || []).slice(0, 6).join(', ') + ((m.keywords || []).length > 6 ? '…' : '');
        this.refs.filterStrip.innerHTML = `
            <div><span class="fs-key">시드 키워드:</span><span class="fs-val">${this.escape(kws)}</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-key">채널:</span><span class="fs-val">뉴스 ${MagazineData.clippings.length}건</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-on">정확도 필터 ${m.accuracyFilter ? 'ON' : 'OFF'}</span></div>
        `;
    },

    escape(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    renderCharts() {
        const trend = MagazineData.getDailyTrend();
        ChartEngine.dailyBarChart('dailyChart', { labels: trend.labels, counts: trend.counts, color: ChartEngine.colors.blue });
        ChartEngine.donutWithCenter('categoryChart', { items: MagazineData.getCategoryMix(), centerLabel: '건' });
        ChartEngine.stackedSentimentBar('sentimentChart', { items: MagazineData.getSentimentMix() });
        ChartEngine.horizontalBarChart('mediaChart', { items: MagazineData.getMediaTop(10), color: ChartEngine.colors.green });
    },

    /**
     * 키워드별 인덱스 패널 렌더 — 카드 그리드
     */
    renderKeywordIndex() {
        const idx = MagazineData.indexByKeyword || [];
        if (idx.length === 0) {
            this.refs.keywordIndex.innerHTML = '<div class="empty-state">시드 키워드 인덱스 정보가 없습니다.</div>';
            return;
        }
        const maxKept = Math.max(...idx.map(x => x.kept), 1);
        this.refs.keywordIndex.innerHTML = idx.map(k => {
            const pct = Math.round((k.kept / maxKept) * 100);
            const ratio = k.raw > 0 ? Math.round((k.kept / k.raw) * 100) : 0;
            return `
                <div class="ki-card">
                    <div class="ki-card-head">
                        <span class="ki-keyword">${this.escape(k.keyword)}</span>
                        <span class="ki-keep">${k.kept}</span>
                    </div>
                    <div class="ki-bar"><div class="ki-bar-fill" style="width:${pct}%"></div></div>
                    <div class="ki-meta">원본 ${k.raw}건 · 통과율 ${ratio}%</div>
                </div>
            `;
        }).join('');
    },

    renderClippings() {
        const list = MagazineData.filter(this.state.category, this.state.query)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        this.refs.clippingCount.textContent = list.length;

        const cat = MagazineData.categories.find(c => c.key === this.state.category);
        const sub = [`카테고리: ${cat ? cat.label : '전체'}`];
        if (this.state.query) sub.push(`검색: "${this.state.query}"`);
        this.refs.clippingSub.textContent = sub.join(' · ');

        if (list.length === 0) {
            this.refs.clippingList.innerHTML = '<div class="empty-state">조건에 맞는 클리핑이 없습니다.</div>';
            return;
        }

        const sentLabel = { positive: '긍정', neutral: '중립', negative: '부정' };
        const collectedDay = (MagazineData.meta.collectedAt || '').slice(0, 10);

        this.refs.clippingList.innerHTML = list.map(c => {
            const isFresh = (c.date || '').slice(0, 10) === collectedDay;
            const cat = MagazineData.categories.find(x => x.key === c.category);
            const catLabel = cat ? cat.label : c.category;
            const catColor = MagazineData.categoryColors[c.category] || '#6b7280';
            return `
            <article class="clipping">
                <div>
                    <div class="clipping-meta">
                        <span class="cat-pill" style="background:${catColor}22;color:${catColor}">${this.escape(catLabel)}</span>
                        <span>${this.escape(c.media)}</span>
                        <span class="dot">·</span>
                        <span>${this.formatDate(c.date)}</span>
                        ${isFresh ? '<span class="fresh-badge">NEW</span>' : ''}
                        ${c.sourceKeyword ? `<span class="kw-tag">${this.escape(c.sourceKeyword)}</span>` : ''}
                    </div>
                    <h4 class="clipping-title"><a href="${this.escape(c.url)}" target="_blank" rel="noopener">${this.escape(c.title)}</a></h4>
                    <p class="clipping-summary">${this.escape(c.summary)}</p>
                    <div class="clipping-tags">
                        ${(c.tags || []).slice(0, 6).map(t => `<span class="tag">#${this.escape(t)}</span>`).join('')}
                    </div>
                </div>
                <span class="sentiment-pill s-${c.sentiment}">${sentLabel[c.sentiment]}</span>
            </article>`;
        }).join('');
    },

    formatDate(s) {
        if (!s) return '';
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
        if (!m) return s;
        return m[4] ? `${m[2]}.${m[3]} ${m[4]}:${m[5]}` : `${m[2]}.${m[3]}`;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CommerceApp.init());
} else {
    CommerceApp.init();
}
