/**
 * Reports Magazine - Application
 * 리서치 리포트 페이지 전용 (data-store/chart-engine 미사용 — 단순 카드 그리드)
 */
const ReportsApp = {
    state: { source: 'all', category: 'all', query: '', expandedUrl: null },
    data: { meta: {}, categories: [], categoryColors: {}, bySource: {}, byCategory: {}, reports: [] },
    indexData: { meta: {}, topicCloud: [], byUrl: {} },
    refs: {},

    async init() {
        this.refs = {
            kpiTotal:      document.getElementById('kpiTotal'),
            kpiFresh:      document.getElementById('kpiFresh'),
            kpiSources:    document.getElementById('kpiSources'),
            kpiCategories: document.getElementById('kpiCategories'),
            kpiTime:       document.getElementById('kpiTime'),
            sourceTabs:    document.getElementById('sourceTabs'),
            categoryTabs:  document.getElementById('categoryTabs'),
            reportStats:   document.getElementById('reportStats'),
            topicCloudWrap:document.getElementById('topicCloudWrap'),
            topicCloud:    document.getElementById('topicCloud'),
            topicCloudSub: document.getElementById('topicCloudSub'),
            reportGrid:    document.getElementById('reportGrid'),
            reportCount:   document.getElementById('reportCount'),
            reportSub:     document.getElementById('reportSub'),
            searchInput:   document.getElementById('searchInput'),
            refreshBtn:    document.getElementById('refreshBtn'),
            pageTitle:     document.getElementById('pageTitle'),
            pageSub:       document.getElementById('pageSub')
        };
        await this.load();
        this.renderAll();
        this.refs.searchInput.addEventListener('input', (e) => {
            this.state.query = e.target.value;
            this.renderGrid();
        });
        this.refs.refreshBtn.addEventListener('click', () => this.refresh());
    },

    async load() {
        try {
            const res = await fetch('assets/data/reports.json', { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.data = await res.json();
            this.data.reports = this.data.reports || [];
            this.data.categories = this.data.categories || [];
            this.data.categoryColors = this.data.categoryColors || {};
            this.data.bySource = this.data.bySource || {};
            this.data.byCategory = this.data.byCategory || {};
        } catch (err) {
            console.error('[ReportsApp] load failed:', err);
            this.data = { meta: {}, categories: [], categoryColors: {}, bySource: {}, byCategory: {}, reports: [] };
        }
        // 토픽 인덱스 (없어도 무방)
        try {
            const res = await fetch('assets/data/report-index.json', { cache: 'no-store' });
            if (res.ok) this.indexData = await res.json();
        } catch { this.indexData = { meta: {}, topicCloud: [], byUrl: {} }; }
        this.indexData.byUrl = this.indexData.byUrl || {};
        this.indexData.topicCloud = this.indexData.topicCloud || [];
    },

    async refresh() {
        this.refs.refreshBtn.classList.add('spin');
        await this.load();
        setTimeout(() => {
            this.refs.refreshBtn.classList.remove('spin');
            this.renderAll();
        }, 300);
    },

    renderAll() {
        this.renderHeader();
        this.renderKPI();
        this.renderSourceTabs();
        this.renderCategoryTabs();
        this.renderStats();
        this.renderTopicCloud();
        this.renderGrid();
    },

    renderTopicCloud() {
        const cloud = this.indexData.topicCloud || [];
        if (cloud.length === 0) {
            this.refs.topicCloudWrap.hidden = true;
            return;
        }
        this.refs.topicCloudWrap.hidden = false;
        const meta = this.indexData.meta || {};
        this.refs.topicCloudSub.textContent =
            `최근 ${meta.indexed || 0}개 PDF 분석 결과 — 각 리포트에서 자주 언급된 키워드 (${meta.indexedAt ? meta.indexedAt.slice(0, 10) : ''})`;
        const max = Math.max(...cloud.map(c => c.count), 1);
        this.refs.topicCloud.innerHTML = cloud.map(c => {
            const scale = 0.85 + (c.count / max) * 0.7; // 0.85x ~ 1.55x
            return `<span class="tc-item" style="font-size:${(scale * 13).toFixed(1)}px">${this.escape(c.keyword)}<em>${c.count}</em></span>`;
        }).join('');
    },

    renderHeader() {
        const m = this.data.meta || {};
        if (m.title) this.refs.pageTitle.textContent = m.title;
        if (m.subtitle) this.refs.pageSub.textContent = m.subtitle;
    },

    renderKPI() {
        const m = this.data.meta || {};
        this.refs.kpiTotal.textContent = m.totalReports || this.data.reports.length;
        this.refs.kpiFresh.textContent = m.freshCount || 0;
        this.refs.kpiSources.textContent = (m.sources || []).length;
        this.refs.kpiCategories.textContent = Object.keys(this.data.byCategory).length;
        this.refs.kpiTime.textContent = m.collectedAt ? this.formatCollectTime(m.collectedAt) : '--';
    },

    formatCollectTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '--';
        const ampm = d.getHours() < 12 ? '오전' : '오후';
        const hh = d.getHours() % 12 || 12;
        return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${hh}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    renderSourceTabs() {
        const sources = this.data.meta?.sources || [];
        const tabs = [{ key: 'all', label: '전체 발행처', count: this.data.reports.length }]
            .concat(sources.map(s => ({ key: s.key, label: s.label, count: this.data.bySource[s.key] || 0 })));
        this.refs.sourceTabs.innerHTML = '';
        tabs.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (t.key === this.state.source ? ' active' : '');
            btn.innerHTML = `${this.escape(t.label)} <span class="tab-count">${t.count}</span>`;
            btn.addEventListener('click', () => {
                this.state.source = t.key;
                this.renderSourceTabs();
                this.renderGrid();
            });
            this.refs.sourceTabs.appendChild(btn);
        });
    },

    renderCategoryTabs() {
        const counts = this.data.byCategory || {};
        const cats = (this.data.categories || []).filter(c => counts[c.key] > 0);
        const tabs = [{ key: 'all', label: '전체', count: this.data.reports.length }]
            .concat(cats.map(c => ({ key: c.key, label: c.label, count: counts[c.key] || 0 })));
        this.refs.categoryTabs.innerHTML = '';
        tabs.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (t.key === this.state.category ? ' active' : '');
            btn.innerHTML = `${this.escape(t.label)} <span class="tab-count">${t.count}</span>`;
            btn.addEventListener('click', () => {
                this.state.category = t.key;
                this.renderCategoryTabs();
                this.renderGrid();
            });
            this.refs.categoryTabs.appendChild(btn);
        });
    },

    renderStats() {
        const sources = this.data.meta?.sources || [];
        if (sources.length === 0) {
            this.refs.reportStats.innerHTML = '';
            return;
        }
        this.refs.reportStats.innerHTML = sources.map(s => {
            const count = this.data.bySource[s.key] || 0;
            return `
                <div class="rs-card">
                    <div class="rs-card-head">
                        <span class="rs-publisher">${this.escape(s.publisher)}</span>
                        <a class="rs-link" href="${this.escape(s.url)}" target="_blank" rel="noopener">↗ 원본</a>
                    </div>
                    <div class="rs-label">${this.escape(s.label)}</div>
                    <div class="rs-count">${count}<span class="rs-count-unit">건</span></div>
                </div>
            `;
        }).join('');
    },

    renderGrid() {
        const list = this.filterReports();
        this.refs.reportCount.textContent = list.length;
        const subParts = [];
        if (this.state.source !== 'all') {
            const src = (this.data.meta?.sources || []).find(s => s.key === this.state.source);
            subParts.push(`발행처: ${src ? src.label : this.state.source}`);
        }
        if (this.state.category !== 'all') subParts.push(`카테고리: ${this.state.category}`);
        if (this.state.query) subParts.push(`검색: "${this.state.query}"`);
        this.refs.reportSub.textContent = subParts.join(' · ');

        if (list.length === 0) {
            this.refs.reportGrid.innerHTML = '<div class="empty-state">조건에 맞는 리포트가 없습니다.</div>';
            return;
        }

        this.refs.reportGrid.innerHTML = list.map(r => {
            const color = this.data.categoryColors[r.category] || '#6b7280';
            const thumb = r.thumbnail
                ? `<img src="${this.escape(r.thumbnail)}" alt="${this.escape(r.title)}" loading="lazy">`
                : `<div class="thumb-placeholder">📄</div>`;
            const dateStr = r.date ? r.date.replace(/-/g, '.') : '';
            const idx = this.indexData.byUrl[r.pdfUrl];
            const expanded = this.state.expandedUrl === r.pdfUrl;
            const hasIndex = idx && !idx.error && (idx.outline?.length > 0 || idx.headings?.length > 0 || idx.keywords?.length > 0);
            return `
                <article class="report-card${expanded ? ' expanded' : ''}">
                    <a class="report-thumb" href="${this.escape(r.url)}" target="_blank" rel="noopener">${thumb}</a>
                    <div class="report-body">
                        <div class="report-meta">
                            <span class="cat-pill" style="background:${color}22;color:${color}">${this.escape(r.category)}</span>
                            <span class="report-publisher">${this.escape(r.publisher)}</span>
                        </div>
                        <h3 class="report-title">
                            <a href="${this.escape(r.url)}" target="_blank" rel="noopener">${this.escape(r.title)}</a>
                        </h3>
                        <div class="report-foot">
                            <span class="report-date">${this.escape(dateStr)}</span>
                            ${r.pdfUrl ? `<a class="pdf-btn" href="${this.escape(r.pdfUrl)}" target="_blank" rel="noopener">PDF ↓</a>` : ''}
                        </div>
                        ${hasIndex ? `
                            <button class="topic-toggle" data-url="${this.escape(r.pdfUrl)}">
                                ${expanded ? '▲ 토픽 인덱스 닫기' : `▾ 토픽 인덱스 (${idx.pageCount}p · 키워드 ${idx.keywords.length}개)`}
                            </button>
                            ${expanded ? this.renderTopicIndex(idx) : ''}
                        ` : ''}
                    </div>
                </article>
            `;
        }).join('');
        this.refs.reportGrid.querySelectorAll('.topic-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = btn.dataset.url;
                this.state.expandedUrl = this.state.expandedUrl === url ? null : url;
                this.renderGrid();
            });
        });
    },

    /**
     * 토픽 인덱스 렌더 — outline / headings / keywords
     */
    renderTopicIndex(idx) {
        const outline = (idx.outline || []).slice(0, 20);
        const headings = (idx.headings || []).slice(0, 12);
        const keywords = (idx.keywords || []).slice(0, 12);

        const outlineHtml = outline.length > 0 ? `
            <div class="ti-section">
                <h5>목차</h5>
                <ol class="ti-outline">
                    ${outline.map(o => `<li class="ti-depth-${Math.min(o.depth, 3)}">${this.escape(o.title)}</li>`).join('')}
                </ol>
            </div>
        ` : '';

        const headingHtml = (outline.length === 0 && headings.length > 0) ? `
            <div class="ti-section">
                <h5>주요 섹션</h5>
                <ul class="ti-headings">
                    ${headings.map(h => `<li>${this.escape(h.text)}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        const keywordHtml = keywords.length > 0 ? `
            <div class="ti-section">
                <h5>핵심 키워드</h5>
                <div class="ti-keywords">
                    ${keywords.map(k => `<span class="ti-kw">${this.escape(k.keyword)}<em>${k.count}</em></span>`).join('')}
                </div>
            </div>
        ` : '';

        return `<div class="topic-index">${outlineHtml}${headingHtml}${keywordHtml}</div>`;
    },

    filterReports() {
        const q = (this.state.query || '').trim().toLowerCase();
        return (this.data.reports || []).filter(r => {
            if (this.state.source !== 'all' && r.source !== this.state.source) return false;
            if (this.state.category !== 'all' && r.category !== this.state.category) return false;
            if (q) {
                const hay = (r.title + ' ' + r.publisher + ' ' + r.category).toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    },

    escape(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ReportsApp.init());
} else {
    ReportsApp.init();
}
