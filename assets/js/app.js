/**
 * SHOKZ Korea Clipping Magazine - Application
 */
const MagazineApp = {
    state: {
        category: 'all',
        query: ''
    },
    refs: {},

    async init() {
        this.refs = {
            kpiTotal: document.getElementById('kpiTotal'),
            kpiMedia: document.getElementById('kpiMedia'),
            kpiPassed: document.getElementById('kpiPassed'),
            kpiNoise: document.getElementById('kpiNoise'),
            kpiTime: document.getElementById('kpiTime'),
            tabs: document.getElementById('tabs'),
            filterStrip: document.getElementById('filterStrip'),
            searchInput: document.getElementById('searchInput'),
            refreshBtn: document.getElementById('refreshBtn'),
            clippingList: document.getElementById('clippingList'),
            clippingCount: document.getElementById('clippingCount'),
            clippingSub: document.getElementById('clippingSub'),
            reactionsBlog: document.getElementById('reactionsBlog'),
            reactionsCafe: document.getElementById('reactionsCafe'),
            reactionsTotal: document.getElementById('reactionsTotal'),
            reactionsKeywords: document.getElementById('reactionsKeywords'),
            reactionsMedia: document.getElementById('reactionsMedia'),
            reactionsSentiment: document.getElementById('reactionsSentiment')
        };

        await MagazineData.load();
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
        await MagazineData.load();
        setTimeout(() => {
            this.refs.refreshBtn.classList.remove('spin');
            this.renderAll();
        }, 300);
    },

    renderAll() {
        this.renderKPI();
        this.renderFilterStrip();
        this.renderTabs();
        this.renderCharts();
        this.renderReactions();
        this.renderClippings();
    },

    debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
    },

    renderKPI() {
        const m = MagazineData.meta;
        this.refs.kpiTotal.textContent = m.totalClippings || MagazineData.clippings.length;
        this.refs.kpiMedia.textContent = MagazineData.getMediaCount();
        this.refs.kpiPassed.textContent = m.filterPassed || MagazineData.clippings.length;
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
        const channelStr = MagazineData.channels.map(ch => `${ch.key}:${ch.collected || 0}/${ch.quota || 20}`).join(', ');
        this.refs.filterStrip.innerHTML = `
            <div><span class="fs-key">검색어:</span><span class="fs-val brand">${this.escape(m.searchKeyword || '샥즈')}</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-key">채널:</span><span class="fs-val">${this.escape(channelStr)}</span></div>
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
        ChartEngine.donutWithCenter('channelChart', { items: MagazineData.getChannelMix(), centerLabel: '건' });
        ChartEngine.donutWithCenter('categoryChart', { items: MagazineData.getCategoryMix(), centerLabel: '건' });
        ChartEngine.stackedSentimentBar('sentimentChart', { items: MagazineData.getSentimentMix() });
        ChartEngine.horizontalBarChart('mediaChart', { items: MagazineData.getMediaTop(10), color: ChartEngine.colors.green });
        ChartEngine.horizontalBarChart('keywordChart', { items: MagazineData.getKeywordTop(10), color: ChartEngine.colors.purple });
    },

    /**
     * 소비자 반응 패널 (블로그·카페만)
     */
    renderReactions() {
        const r = MagazineData.getReactionsSummary();
        this.refs.reactionsBlog.textContent = r.blog;
        this.refs.reactionsCafe.textContent = r.cafe;
        this.refs.reactionsTotal.textContent = r.total;
        ChartEngine.stackedSentimentBar('reactionsSentimentChart', { items: r.sentiment });
        this.refs.reactionsKeywords.innerHTML = r.keywords.map((k, i) =>
            `<li><span class="r-rank">${i + 1}</span><span class="r-label">${this.escape(k.label)}</span><span class="r-val">${k.value}</span></li>`
        ).join('') || '<li class="r-empty">데이터 없음</li>';
        this.refs.reactionsMedia.innerHTML = r.media.map((m, i) =>
            `<li><span class="r-rank">${i + 1}</span><span class="r-label">${this.escape(this.shortenMedia(m.label))}</span><span class="r-val">${m.value}</span></li>`
        ).join('') || '<li class="r-empty">데이터 없음</li>';
    },

    shortenMedia(s) {
        return s.length > 22 ? s.slice(0, 22) + '…' : s;
    },

    /**
     * 메인 클리핑 카드 — 뉴스만 노출
     */
    renderClippings() {
        const list = MagazineData.filter(this.state.category, this.state.query, { onlyNews: true })
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        this.refs.clippingCount.textContent = list.length;

        const cat = MagazineData.categories.find(c => c.key === this.state.category);
        const subParts = [`뉴스 카드만 표시`];
        subParts.push(`카테고리: ${cat ? cat.label : '전체'}`);
        if (this.state.query) subParts.push(`검색: "${this.state.query}"`);
        this.refs.clippingSub.textContent = subParts.join(' · ');

        if (list.length === 0) {
            this.refs.clippingList.innerHTML = '<div class="empty-state">조건에 맞는 뉴스가 없습니다.</div>';
            return;
        }

        const sentLabel = { positive: '긍정', neutral: '중립', negative: '부정' };
        const channelLabel = { news: 'NEWS', blog: 'BLOG', cafearticle: 'CAFE' };
        const collectedDay = (MagazineData.meta.collectedAt || '').slice(0, 10);

        this.refs.clippingList.innerHTML = list.map(c => {
            const isFresh = (c.date || '').slice(0, 10) === collectedDay;
            return `
            <article class="clipping">
                <div>
                    <div class="clipping-meta">
                        <span class="clipping-channel ch-${c.channel}">${channelLabel[c.channel] || c.channel}</span>
                        <span>${this.escape(c.media)}</span>
                        <span class="dot">·</span>
                        <span>${this.formatDate(c.date)}</span>
                        ${isFresh ? '<span class="fresh-badge">NEW</span>' : ''}
                    </div>
                    <h4 class="clipping-title"><a href="${this.escape(c.url)}" target="_blank" rel="noopener">${this.escape(c.title)}</a></h4>
                    <p class="clipping-summary">${this.escape(c.summary)}</p>
                    <div class="clipping-tags">
                        ${(c.tags || []).map(t => `<span class="tag">#${this.escape(t)}</span>`).join('')}
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
    document.addEventListener('DOMContentLoaded', () => MagazineApp.init());
} else {
    MagazineApp.init();
}
