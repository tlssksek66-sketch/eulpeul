/**
 * SHOKZ Korea Clipping Magazine - Application
 */
const MagazineApp = {
    state: {
        category: 'all',
        query: ''
    },

    refs: {},

    /**
     * 초기 부트스트랩
     */
    init() {
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
            clippingSub: document.getElementById('clippingSub')
        };

        this.renderKPI();
        this.renderFilterStrip();
        this.renderTabs();
        this.renderCharts();
        this.renderClippings();

        this.refs.searchInput.addEventListener('input', (e) => {
            this.state.query = e.target.value;
            this.renderClippings();
        });

        this.refs.refreshBtn.addEventListener('click', () => this.refresh());

        window.addEventListener('resize', this.debounce(() => this.renderCharts(), 200));
    },

    /**
     * 새로고침: 회전 애니메이션 + 차트 재렌더
     */
    refresh() {
        this.refs.refreshBtn.classList.add('spin');
        setTimeout(() => {
            this.refs.refreshBtn.classList.remove('spin');
            this.renderCharts();
            this.renderClippings();
        }, 400);
    },

    debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    },

    /**
     * KPI 렌더
     */
    renderKPI() {
        const m = MagazineData.meta;
        this.refs.kpiTotal.textContent = m.totalClippings;
        this.refs.kpiMedia.textContent = MagazineData.getMediaCount();
        this.refs.kpiPassed.textContent = m.filterPassed;
        this.refs.kpiNoise.textContent = m.noiseFiltered;
        const d = new Date(m.collectedAt);
        const ampm = d.getHours() < 12 ? '오전' : '오후';
        const hh = d.getHours() % 12 || 12;
        const fmt = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${hh}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        this.refs.kpiTime.textContent = fmt;
    },

    /**
     * 카테고리 탭 렌더
     */
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

    /**
     * 필터 스트립 렌더
     */
    renderFilterStrip() {
        const m = MagazineData.meta;
        const channelStr = MagazineData.channels
            .map(ch => `${ch.key}:${ch.collected}/${ch.quota}`)
            .join(', ');
        this.refs.filterStrip.innerHTML = `
            <div><span class="fs-key">검색어:</span><span class="fs-val brand">${this.escape(m.searchKeyword)}</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-key">채널:</span><span class="fs-val">${this.escape(channelStr)}</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-on">정확도 필터 ${m.accuracyFilter ? 'ON' : 'OFF'}</span></div>
        `;
    },

    /**
     * HTML 이스케이프
     */
    escape(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    /**
     * 모든 차트 렌더
     */
    renderCharts() {
        // 일별 추이
        const trend = MagazineData.getDailyTrend();
        ChartEngine.dailyBarChart('dailyChart', {
            labels: trend.labels,
            counts: trend.counts,
            color: ChartEngine.colors.blue
        });

        // 채널 믹스
        ChartEngine.donutWithCenter('channelChart', {
            items: MagazineData.getChannelMix(),
            centerLabel: '건'
        });

        // 카테고리 믹스
        ChartEngine.donutWithCenter('categoryChart', {
            items: MagazineData.getCategoryMix(),
            centerLabel: '건'
        });

        // 감성
        ChartEngine.stackedSentimentBar('sentimentChart', {
            items: MagazineData.getSentimentMix()
        });

        // 매체 Top 10
        ChartEngine.horizontalBarChart('mediaChart', {
            items: MagazineData.getMediaTop(10),
            color: ChartEngine.colors.green
        });

        // 키워드 Top 10
        ChartEngine.horizontalBarChart('keywordChart', {
            items: MagazineData.getKeywordTop(10),
            color: ChartEngine.colors.purple
        });
    },

    /**
     * 클리핑 카드 렌더
     */
    renderClippings() {
        const list = MagazineData.filter(this.state.category, this.state.query)
            .sort((a, b) => b.date.localeCompare(a.date));

        this.refs.clippingCount.textContent = list.length;

        const cat = MagazineData.categories.find(c => c.key === this.state.category);
        const subParts = [];
        subParts.push(`카테고리: ${cat ? cat.label : '전체'}`);
        if (this.state.query) subParts.push(`검색: "${this.state.query}"`);
        this.refs.clippingSub.textContent = subParts.join(' · ');

        if (list.length === 0) {
            this.refs.clippingList.innerHTML = '<div class="empty-state">조건에 맞는 클리핑이 없습니다.</div>';
            return;
        }

        const sentimentLabel = { positive: '긍정', neutral: '중립', negative: '부정' };
        const channelLabel = {
            news: 'NEWS', blog: 'BLOG', cafearticle: 'CAFE'
        };

        this.refs.clippingList.innerHTML = list.map(c => `
            <article class="clipping">
                <div>
                    <div class="clipping-meta">
                        <span class="clipping-channel ch-${c.channel}">${channelLabel[c.channel] || c.channel}</span>
                        <span>${this.escape(c.media)}</span>
                        <span class="dot">·</span>
                        <span>${this.formatDate(c.date)}</span>
                    </div>
                    <h4 class="clipping-title"><a href="${this.escape(c.url)}" target="_blank" rel="noopener">${this.escape(c.title)}</a></h4>
                    <p class="clipping-summary">${this.escape(c.summary)}</p>
                    <div class="clipping-tags">
                        ${(c.tags || []).map(t => `<span class="tag">#${this.escape(t)}</span>`).join('')}
                    </div>
                </div>
                <span class="sentiment-pill s-${c.sentiment}">${sentimentLabel[c.sentiment]}</span>
            </article>
        `).join('');
    },

    /**
     * 날짜 포맷 (YYYY-MM-DD HH:mm → MM.DD HH:mm)
     */
    formatDate(s) {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
        if (!m) return s;
        return `${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
    }
};

// 부트스트랩
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MagazineApp.init());
} else {
    MagazineApp.init();
}
