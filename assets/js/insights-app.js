/**
 * Ad Insight KB - Application
 */
const InsightsApp = {
    state: { filter: 'all', filterValue: null, query: '' },
    data: { meta: {}, topBrands: [], topPlatforms: [], topIndustries: [], topAudiences: [], byUrl: {} },
    roadmap: null,
    refs: {},

    async init() {
        this.refs = {
            kpiTotal: document.getElementById('kpiTotal'),
            kpiBrands: document.getElementById('kpiBrands'),
            kpiPlatforms: document.getElementById('kpiPlatforms'),
            kpiIndustries: document.getElementById('kpiIndustries'),
            kpiTime: document.getElementById('kpiTime'),
            cloudBrands: document.getElementById('cloudBrands'),
            cloudPlatforms: document.getElementById('cloudPlatforms'),
            cloudIndustries: document.getElementById('cloudIndustries'),
            cloudAudiences: document.getElementById('cloudAudiences'),
            filterTabs: document.getElementById('filterTabs'),
            filterStrip: document.getElementById('filterStrip'),
            insightList: document.getElementById('insightList'),
            insightCount: document.getElementById('insightCount'),
            insightSub: document.getElementById('insightSub'),
            searchInput: document.getElementById('searchInput'),
            refreshBtn: document.getElementById('refreshBtn'),
            roadmapWrap: document.getElementById('roadmapWrap'),
            roadmapSummary: document.getElementById('roadmapSummary'),
            roadmapPillars: document.getElementById('roadmapPillars'),
            saList: document.getElementById('saList'),
            gfaList: document.getElementById('gfaList'),
            saCount: document.getElementById('saCount'),
            gfaCount: document.getElementById('gfaCount'),
            roadmapCaveats: document.getElementById('roadmapCaveats'),
            caveatsList: document.getElementById('caveatsList'),
            roadmapMeta: document.getElementById('roadmapMeta')
        };
        await this.load();
        this.renderAll();
        this.refs.searchInput.addEventListener('input', (e) => {
            this.state.query = e.target.value;
            this.renderList();
        });
        this.refs.refreshBtn.addEventListener('click', () => this.refresh());
    },

    async load() {
        try {
            const res = await fetch('assets/data/insights.json', { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.data = await res.json();
            this.data.byUrl = this.data.byUrl || {};
        } catch (err) {
            console.error('[InsightsApp] load failed:', err);
            this.data = { meta: {}, topBrands: [], topPlatforms: [], topIndustries: [], topAudiences: [], byUrl: {} };
        }
        try {
            const res = await fetch('assets/data/roadmap.json', { cache: 'no-store' });
            if (res.ok) {
                const rm = await res.json();
                this.roadmap = (rm.saPlays?.length || rm.gfaPlays?.length) ? rm : null;
            }
        } catch (err) {
            console.warn('[InsightsApp] roadmap load skipped:', err.message);
            this.roadmap = null;
        }
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
        this.renderKPI();
        this.renderClouds();
        this.renderFilterTabs();
        this.renderFilterStrip();
        this.renderList();
        this.renderRoadmap();
    },

    escape(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    insights() {
        return Object.entries(this.data.byUrl)
            .filter(([, v]) => v.insight)
            .map(([url, v]) => ({ url, ...v }));
    },

    renderKPI() {
        const list = this.insights();
        this.refs.kpiTotal.textContent = list.length;
        this.refs.kpiBrands.textContent = (this.data.topBrands || []).length;
        this.refs.kpiPlatforms.textContent = (this.data.topPlatforms || []).length;
        this.refs.kpiIndustries.textContent = (this.data.topIndustries || []).length;
        const m = this.data.meta || {};
        this.refs.kpiTime.textContent = m.extractedAt ? this.formatTime(m.extractedAt) : '--';
    },

    formatTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '--';
        const ampm = d.getHours() < 12 ? '오전' : '오후';
        const hh = d.getHours() % 12 || 12;
        return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${hh}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    renderClouds() {
        this.renderCloud(this.refs.cloudBrands, this.data.topBrands || [], 'brand');
        this.renderCloud(this.refs.cloudPlatforms, this.data.topPlatforms || [], 'platform');
        this.renderCloud(this.refs.cloudIndustries, this.data.topIndustries || [], 'industry');
        this.renderCloud(this.refs.cloudAudiences, this.data.topAudiences || [], 'audience');
    },

    renderCloud(container, items, kind) {
        if (!items.length) {
            container.innerHTML = '<span class="tc-empty">데이터 없음</span>';
            return;
        }
        const max = Math.max(...items.map(i => i.count), 1);
        container.innerHTML = items.slice(0, 12).map(it => {
            const scale = 0.85 + (it.count / max) * 0.55;
            const active = (this.state.filter === kind && this.state.filterValue === it.label) ? ' active' : '';
            return `<button class="tc-chip${active}" data-kind="${kind}" data-value="${this.escape(it.label)}" style="font-size:${(scale * 13).toFixed(1)}px">${this.escape(it.label)}<em>${it.count}</em></button>`;
        }).join('');
        container.querySelectorAll('.tc-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const k = btn.dataset.kind, v = btn.dataset.value;
                if (this.state.filter === k && this.state.filterValue === v) {
                    this.state.filter = 'all'; this.state.filterValue = null;
                } else {
                    this.state.filter = k; this.state.filterValue = v;
                }
                this.renderClouds();
                this.renderFilterTabs();
                this.renderFilterStrip();
                this.renderList();
            });
        });
    },

    renderFilterTabs() {
        const types = [
            { key: 'all', label: '전체' },
            { key: 'brand', label: '브랜드' },
            { key: 'platform', label: '플랫폼' },
            { key: 'industry', label: '산업' },
            { key: 'audience', label: '오디언스' }
        ];
        this.refs.filterTabs.innerHTML = '';
        types.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (this.state.filter === t.key ? ' active' : '');
            btn.textContent = t.label;
            btn.addEventListener('click', () => {
                this.state.filter = t.key;
                this.state.filterValue = null;
                this.renderClouds();
                this.renderFilterTabs();
                this.renderFilterStrip();
                this.renderList();
            });
            this.refs.filterTabs.appendChild(btn);
        });
    },

    renderFilterStrip() {
        const m = this.data.meta || {};
        const usage = m.usageThisRun || {};
        const cost = usage.estimated_cost_usd ? `$${usage.estimated_cost_usd}` : '–';
        const filterText = this.state.filter !== 'all' && this.state.filterValue
            ? `필터: ${this.escape(this.state.filter)} = ${this.escape(this.state.filterValue)}`
            : '필터: 없음';
        this.refs.filterStrip.innerHTML = `
            <div><span class="fs-key">모델:</span><span class="fs-val">${this.escape(m.model || '-')}</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-key">최근 비용:</span><span class="fs-val">${cost}</span></div>
            <span class="fs-divider">·</span>
            <div><span class="fs-on">${this.escape(filterText)}</span></div>
        `;
    },

    matchesFilter(insight) {
        if (this.state.filter === 'all') return true;
        const v = this.state.filterValue;
        if (!v) return true;
        const ins = insight.insight;
        if (this.state.filter === 'brand') return (ins.brands || []).includes(v);
        if (this.state.filter === 'platform') return (ins.platforms || []).includes(v);
        if (this.state.filter === 'industry') return (ins.industries || []).includes(v);
        if (this.state.filter === 'audience') return (ins.audienceSegments || []).includes(v);
        return true;
    },

    matchesQuery(insight) {
        const q = (this.state.query || '').trim().toLowerCase();
        if (!q) return true;
        const ins = insight.insight;
        const hay = [
            insight.title, insight.publisher, ins.usageContext, ins.pitchHook,
            ...(ins.coreFindings || []),
            ...(ins.brands || []), ...(ins.platforms || []),
            ...(ins.industries || []), ...(ins.audienceSegments || []),
            ...(ins.metrics || []).map(m => `${m.label} ${m.value} ${m.context || ''}`)
        ].join(' ').toLowerCase();
        return hay.includes(q);
    },

    renderList() {
        const list = this.insights()
            .filter(i => this.matchesFilter(i) && this.matchesQuery(i))
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        this.refs.insightCount.textContent = list.length;
        const sub = [];
        if (this.state.filter !== 'all' && this.state.filterValue) sub.push(`${this.state.filter}: ${this.state.filterValue}`);
        if (this.state.query) sub.push(`검색: "${this.state.query}"`);
        this.refs.insightSub.textContent = sub.join(' · ');

        if (list.length === 0) {
            this.refs.insightList.innerHTML = '<div class="empty-state">조건에 맞는 인사이트가 없습니다.</div>';
            return;
        }

        this.refs.insightList.innerHTML = list.map(it => {
            const ins = it.insight;
            const dateStr = it.date ? it.date.replace(/-/g, '.') : '';
            return `
                <article class="insight-card">
                    <div class="ic-head">
                        <div class="ic-meta">
                            <span class="ic-publisher">${this.escape(it.publisher)}</span>
                            <span class="dot">·</span>
                            <span class="ic-date">${this.escape(dateStr)}</span>
                            <span class="dot">·</span>
                            <span class="ic-pages">${it.pageCount}p</span>
                        </div>
                        <h3 class="ic-title"><a href="${this.escape(it.url)}" target="_blank" rel="noopener">${this.escape(it.title)}</a></h3>
                        <p class="ic-hook">${this.escape(ins.pitchHook || '')}</p>
                    </div>

                    <div class="ic-section">
                        <h5>핵심 발견</h5>
                        <ul class="ic-findings">
                            ${(ins.coreFindings || []).map(f => `<li>${this.escape(f)}</li>`).join('')}
                        </ul>
                    </div>

                    ${(ins.metrics || []).length > 0 ? `
                        <div class="ic-section">
                            <h5>주요 수치</h5>
                            <div class="ic-metrics">
                                ${ins.metrics.map(m => `
                                    <div class="ic-metric">
                                        <div class="ic-metric-label">${this.escape(m.label)}</div>
                                        <div class="ic-metric-value">${this.escape(m.value)}</div>
                                        ${m.context ? `<div class="ic-metric-context">${this.escape(m.context)}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="ic-tags">
                        ${(ins.brands || []).slice(0, 6).map(b => `<span class="ic-tag tag-brand">${this.escape(b)}</span>`).join('')}
                        ${(ins.platforms || []).slice(0, 6).map(p => `<span class="ic-tag tag-platform">${this.escape(p)}</span>`).join('')}
                        ${(ins.industries || []).slice(0, 4).map(i => `<span class="ic-tag tag-industry">${this.escape(i)}</span>`).join('')}
                        ${(ins.audienceSegments || []).slice(0, 4).map(a => `<span class="ic-tag tag-audience">${this.escape(a)}</span>`).join('')}
                    </div>

                    <div class="ic-usage">
                        <h5>활용 맥락</h5>
                        <p>${this.escape(ins.usageContext || '')}</p>
                    </div>
                </article>
            `;
        }).join('');
    },

    renderRoadmap() {
        const wrap = this.refs.roadmapWrap;
        if (!wrap) return;
        const rm = this.roadmap;
        if (!rm || (!rm.saPlays?.length && !rm.gfaPlays?.length)) {
            wrap.hidden = true;
            return;
        }
        wrap.hidden = false;

        this.refs.roadmapSummary.textContent = rm.summary || '';

        this.refs.roadmapPillars.innerHTML = (rm.audiencePillars || [])
            .map(p => `<span class="rm-pillar">${this.escape(p)}</span>`).join('');

        const saArr = rm.saPlays || [];
        const gfaArr = rm.gfaPlays || [];
        this.refs.saCount.textContent = saArr.length;
        this.refs.gfaCount.textContent = gfaArr.length;

        this.refs.saList.innerHTML = saArr.map((p, i) => this.renderSaPlay(p, i + 1)).join('');
        this.refs.gfaList.innerHTML = gfaArr.map((p, i) => this.renderGfaPlay(p, i + 1)).join('');

        const caveats = rm.caveats || [];
        this.refs.roadmapCaveats.hidden = caveats.length === 0;
        this.refs.caveatsList.innerHTML = caveats.map(c => `<li>${this.escape(c)}</li>`).join('');

        const m = rm.meta || {};
        const cost = m.usage?.estimated_cost_usd ? `$${m.usage.estimated_cost_usd}` : '–';
        const built = m.builtAt ? this.formatTime(m.builtAt) : '--';
        this.refs.roadmapMeta.innerHTML = `
            <span class="fs-key">생성:</span><span class="fs-val">${this.escape(built)}</span>
            <span class="fs-divider">·</span>
            <span class="fs-key">근거 카드:</span><span class="fs-val">${m.cardsCount || 0}건</span>
            <span class="fs-divider">·</span>
            <span class="fs-key">모델:</span><span class="fs-val">${this.escape(m.model || '-')}</span>
            <span class="fs-divider">·</span>
            <span class="fs-key">비용:</span><span class="fs-val">${cost}</span>
        `;
    },

    chips(arr, klass = '') {
        return (arr || []).map(s => `<span class="rm-chip ${klass}">${this.escape(s)}</span>`).join('');
    },

    kvRow(label, value) {
        if (!value) return '';
        return `<div class="rm-kv"><dt>${this.escape(label)}</dt><dd>${this.escape(value)}</dd></div>`;
    },

    renderSaPlay(p, n) {
        return `
            <article class="rm-play rm-sa">
                <div class="rm-play-head">
                    <span class="rm-num">SA-${String(n).padStart(2, '0')}</span>
                    <h4>${this.escape(p.title)}</h4>
                </div>
                <p class="rm-rationale">${this.escape(p.rationale || '')}</p>
                <div class="rm-tags">
                    ${this.chips(p.targetIndustries, 'tag-industry')}
                    ${this.chips(p.targetAudiences, 'tag-audience')}
                </div>
                <div class="rm-section">
                    <h5>시드 키워드</h5>
                    <div class="rm-keywords">${this.chips(p.seedKeywords, 'kw-seed')}</div>
                </div>
                ${p.negativeKeywords?.length ? `
                    <div class="rm-section">
                        <h5>제외 키워드</h5>
                        <div class="rm-keywords">${this.chips(p.negativeKeywords, 'kw-neg')}</div>
                    </div>` : ''}
                <dl class="rm-kvs">
                    ${this.kvRow('매칭 타입', p.matchType)}
                    ${this.kvRow('입찰 전략', p.biddingStrategy)}
                    ${this.kvRow('광고문안 톤', p.adCopyTone)}
                    ${this.kvRow('랜딩 단서', p.landingHint)}
                    ${this.kvRow('KPI 타겟', p.kpiTarget)}
                </dl>
            </article>
        `;
    },

    renderGfaPlay(p, n) {
        return `
            <article class="rm-play rm-gfa">
                <div class="rm-play-head">
                    <span class="rm-num">GFA-${String(n).padStart(2, '0')}</span>
                    <h4>${this.escape(p.title)}</h4>
                </div>
                <p class="rm-rationale">${this.escape(p.rationale || '')}</p>
                <div class="rm-tags">
                    ${this.chips(p.targetIndustries, 'tag-industry')}
                    ${this.chips(p.targetAudiences, 'tag-audience')}
                </div>
                <dl class="rm-kvs">
                    ${this.kvRow('데모 타겟', p.demoTargeting)}
                    ${this.kvRow('관심사 세그먼트', (p.interestSegments || []).join(' · '))}
                    ${this.kvRow('노출 매체', (p.placements || []).join(' · '))}
                    ${this.kvRow('소재 메시지', p.creativeMessage)}
                    ${this.kvRow('CTA 카피', p.ctaCopy)}
                    ${this.kvRow('빈도 cap', p.frequencyCap)}
                    ${this.kvRow('입찰 전략', p.bidStrategy)}
                    ${this.kvRow('KPI 타겟', p.kpiTarget)}
                </dl>
            </article>
        `;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => InsightsApp.init());
} else {
    InsightsApp.init();
}
