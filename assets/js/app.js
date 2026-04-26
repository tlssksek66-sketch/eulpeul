/**
 * App - 메인 애플리케이션 로직
 * 영업 기획 & IMC 매니지먼트 중앙 통제 시스템
 */
const App = {
    data: null,
    currentView: 'dashboard',

    /**
     * 앱 초기화
     */
    init() {
        this.data = DataStore.load();
        this.bindEvents();
        this.renderDashboard();
        this.renderNotifications();
        this.startAutoRefresh();
    },

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // 네비게이션
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchView(view);
            });
        });

        // 모바일 메뉴 토글
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });

        // 알림 패널
        document.getElementById('notificationBtn').addEventListener('click', () => {
            document.getElementById('notificationPanel').classList.toggle('active');
        });

        // 모달 닫기
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        // 새로고침 버튼
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshCurrentView();
        });

        // 영업 필터
        const salesFilter = document.getElementById('salesFilter');
        if (salesFilter) {
            salesFilter.addEventListener('change', () => this.renderSalesPlans());
        }

        // 매출 차트 기간 변경
        const revPeriod = document.getElementById('revenueChartPeriod');
        if (revPeriod) {
            revPeriod.addEventListener('change', () => this.renderRevenueChart());
        }

        // 다크모드 (이미 기본 다크모드)
        const darkToggle = document.getElementById('darkModeToggle');
        if (darkToggle) {
            darkToggle.checked = true;
        }

        // 윈도우 리사이즈 시 차트 리렌더
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.refreshCurrentView(), 300);
        });

        // 검색
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // 매거진 카테고리 탭
        document.querySelectorAll('.mag-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.mag-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.magState.category = tab.dataset.cat;
                this.renderMagazineGrid();
            });
        });

        // 매거진 정렬
        const magSort = document.getElementById('magSort');
        if (magSort) {
            magSort.addEventListener('change', (e) => {
                this.magState.sort = e.target.value;
                this.renderMagazine();
            });
        }

        // 매거진 검색
        const magSearchInput = document.getElementById('magSearchInput');
        if (magSearchInput) {
            magSearchInput.addEventListener('input', (e) => {
                this.magState.query = e.target.value.trim();
                this.renderMagazineGrid();
            });
        }
    },

    // 매거진 상태
    magState: { category: 'all', sort: 'latest', query: '' },

    /**
     * 뷰 전환
     */
    switchView(viewName) {
        this.currentView = viewName;

        // 네비게이션 활성화
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // 뷰 전환
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById('view-' + viewName);
        if (targetView) targetView.classList.add('active');

        // 제목 변경
        const titles = {
            dashboard: '중앙 통제 대시보드',
            sales: '영업 기획 관리',
            imc: 'IMC 매니지먼트',
            magazine: '샥즈 코리아 매거진',
            pipeline: '영업 파이프라인',
            analytics: '분석 & 리포트',
            settings: '시스템 설정'
        };
        document.getElementById('pageTitle').textContent = titles[viewName] || '대시보드';

        // 뷰별 렌더링
        this.refreshCurrentView();

        // 모바일 사이드바 닫기
        document.getElementById('sidebar').classList.remove('active');
    },

    /**
     * 현재 뷰 새로고침
     */
    refreshCurrentView() {
        switch (this.currentView) {
            case 'dashboard': this.renderDashboard(); break;
            case 'sales': this.renderSalesView(); break;
            case 'imc': this.renderIMCView(); break;
            case 'magazine': this.renderMagazine(); break;
            case 'pipeline': this.renderPipeline(); break;
            case 'analytics': this.renderAnalytics(); break;
        }
    },

    // ==========================================
    // 대시보드 렌더링
    // ==========================================
    renderDashboard() {
        this.renderRevenueChart();
        this.renderChannelChart();
        this.renderActivityFeed();
        this.renderCampaignTable();
    },

    renderRevenueChart() {
        const period = document.getElementById('revenueChartPeriod')?.value || 'monthly';
        const revData = this.data.revenueData[period] || this.data.revenueData.monthly;

        const datasets = [
            { label: '실적', data: revData.actual, color: '#4a7cff', fill: true }
        ];
        if (revData.target) {
            datasets.push({ label: '목표', data: revData.target, color: '#5a5f73' });
        }
        if (revData.forecast) {
            datasets.push({ label: '예측', data: revData.forecast, color: '#a78bfa', dashed: true });
        }

        ChartEngine.lineChart('revenueChart', {
            labels: revData.labels,
            datasets: datasets
        });
    },

    renderChannelChart() {
        const channels = {};
        this.data.campaigns.forEach(c => {
            if (!channels[c.channel]) channels[c.channel] = 0;
            channels[c.channel] += c.budget;
        });

        const channelNames = { digital: '디지털', social: '소셜', content: '콘텐츠', event: '이벤트' };
        ChartEngine.doughnutChart('channelChart', {
            labels: Object.keys(channels).map(k => channelNames[k] || k),
            data: Object.values(channels)
        });
    },

    renderActivityFeed() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        feed.innerHTML = this.data.activities.map(act => `
            <div class="activity-item">
                <div class="activity-dot" style="background: ${act.color}"></div>
                <div class="activity-content">
                    <p class="activity-text">${act.text}</p>
                    <p class="activity-time">${act.time}</p>
                </div>
            </div>
        `).join('');
    },

    renderCampaignTable() {
        const tbody = document.getElementById('campaignTableBody');
        if (!tbody) return;

        const channelNames = { digital: '디지털', social: '소셜', content: '콘텐츠', event: '이벤트' };
        const statusNames = { active: '진행 중', completed: '완료', pending: '대기', paused: '일시중지' };

        tbody.innerHTML = this.data.campaigns.slice(0, 8).map(c => `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${channelNames[c.channel] || c.channel}</td>
                <td><span class="status-badge status-${c.status}">${statusNames[c.status]}</span></td>
                <td>₩${(c.budget / 10000).toLocaleString()}만</td>
                <td style="color: ${c.roi > 250 ? '#34d399' : c.roi > 150 ? '#fbbf24' : '#f87171'}">${c.roi}%</td>
                <td>
                    <div class="progress-bar" style="width:100px">
                        <div class="progress-fill" style="width:${c.progress}%"></div>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // ==========================================
    // 영업 기획 렌더링
    // ==========================================
    renderSalesView() {
        this.renderSalesPlans();
        this.renderQuarterlyChart();
        this.renderTeamChart();

        const stats = DataStore.getStats(this.data);
        this.setText('totalPlans', stats.totalPlans);
        this.setText('activePlans', stats.activePlans);
        this.setText('completedPlans', stats.completedPlans);
        this.setText('pendingPlans', stats.pendingPlans);
    },

    renderSalesPlans() {
        const filter = document.getElementById('salesFilter')?.value || 'all';
        let plans = this.data.salesPlans;
        if (filter !== 'all') {
            plans = plans.filter(p => p.status === filter);
        }

        const statusNames = { active: '진행 중', completed: '완료', pending: '대기' };
        const tbody = document.getElementById('salesPlanTableBody');
        if (!tbody) return;

        tbody.innerHTML = plans.map(p => {
            const rate = p.targetRevenue > 0 ? Math.round((p.achievedRevenue / p.targetRevenue) * 100) : 0;
            return `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.manager}</td>
                <td>${p.startDate} ~ ${p.endDate}</td>
                <td>₩${(p.targetRevenue / 100000000).toFixed(1)}억</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div class="progress-bar" style="width:80px">
                            <div class="progress-fill" style="width:${Math.min(rate, 100)}%"></div>
                        </div>
                        <span style="font-size:12px;font-weight:600">${rate}%</span>
                    </div>
                </td>
                <td><span class="status-badge status-${p.status}">${statusNames[p.status]}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="App.editSalesPlan(${p.id})">수정</button>
                </td>
            </tr>
            `;
        }).join('');
    },

    renderQuarterlyChart() {
        const qd = this.data.quarterlyGoals;
        ChartEngine.barChart('quarterlyGoalChart', {
            labels: qd.labels,
            datasets: [
                { label: '목표', data: qd.target, color: '#5a5f73' },
                { label: '달성', data: qd.achieved, color: '#4a7cff' }
            ]
        });
    },

    renderTeamChart() {
        const td = this.data.teamPerformance;
        ChartEngine.barChart('teamPerformanceChart', {
            labels: td.labels,
            datasets: [
                { label: '목표', data: td.target, color: '#5a5f73' },
                { label: '달성', data: td.achieved, color: '#34d399' }
            ]
        });
    },

    // ==========================================
    // IMC 매니지먼트 렌더링
    // ==========================================
    renderIMCView() {
        this.renderCampaignTimeline();
        this.renderBudgetChart();
        this.renderSynergyMatrix();
    },

    renderCampaignTimeline() {
        const timeline = document.getElementById('campaignTimeline');
        if (!timeline) return;

        const sorted = [...this.data.campaigns].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        const statusNames = { active: '진행 중', completed: '완료', pending: '대기' };
        const channelNames = { digital: '디지털', social: '소셜', content: '콘텐츠', event: '이벤트' };
        const statusColors = { active: '#34d399', completed: '#4a7cff', pending: '#fbbf24' };

        timeline.innerHTML = sorted.map((c, i) => `
            <div class="timeline-item">
                <div class="timeline-marker">
                    <div class="timeline-dot" style="background:${statusColors[c.status]}"></div>
                    ${i < sorted.length - 1 ? '<div class="timeline-line"></div>' : ''}
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${c.name}</div>
                    <div class="timeline-desc">
                        ${channelNames[c.channel]} · ${statusNames[c.status]} · 예산 ₩${(c.budget / 10000).toLocaleString()}만 · ROI ${c.roi}%
                    </div>
                    <div class="timeline-date">${c.startDate} ~ ${c.endDate}</div>
                </div>
            </div>
        `).join('');
    },

    renderBudgetChart() {
        const channels = {};
        this.data.campaigns.forEach(c => {
            if (!channels[c.channel]) channels[c.channel] = 0;
            channels[c.channel] += c.budget;
        });

        const channelNames = { digital: '디지털', social: '소셜', content: '콘텐츠', event: '이벤트' };
        ChartEngine.doughnutChart('budgetAllocationChart', {
            labels: Object.keys(channels).map(k => channelNames[k] || k),
            data: Object.values(channels)
        });
    },

    renderSynergyMatrix() {
        const matrix = document.getElementById('synergyMatrix');
        if (!matrix) return;

        const channels = ['디지털', '소셜', '콘텐츠', '이벤트'];
        const synergy = [
            [100, 85, 70, 55],
            [85, 100, 75, 60],
            [70, 75, 100, 65],
            [55, 60, 65, 100]
        ];

        let html = '<div class="matrix-row"><div class="matrix-label"></div>';
        channels.forEach(ch => { html += `<div class="matrix-label">${ch}</div>`; });
        html += '</div>';

        synergy.forEach((row, i) => {
            html += `<div class="matrix-row"><div class="matrix-label">${channels[i]}</div>`;
            row.forEach(val => {
                const opacity = val / 100;
                const color = val === 100 ? '#4a7cff' : `rgba(74, 124, 255, ${opacity * 0.7})`;
                html += `<div class="matrix-cell" style="background:${color}">${val}%</div>`;
            });
            html += '</div>';
        });

        matrix.innerHTML = html;
    },

    // ==========================================
    // 파이프라인 렌더링
    // ==========================================
    renderPipeline() {
        const stages = ['lead', 'contact', 'proposal', 'negotiation', 'closed'];
        const stageNames = { lead: '리드', contact: '접촉', proposal: '제안', negotiation: '협상', closed: '계약' };

        stages.forEach(stage => {
            const deals = this.data.deals.filter(d => d.stage === stage);
            const container = document.getElementById(stage + 'Cards');
            const countEl = document.getElementById(stage + 'Count');
            const totalEl = document.getElementById(stage + 'Total');

            if (countEl) countEl.textContent = deals.length;
            if (totalEl) {
                const total = deals.reduce((s, d) => s + d.amount, 0);
                totalEl.textContent = '₩' + (total / 100000000).toFixed(1) + '억';
            }

            if (container) {
                container.innerHTML = deals.map(d => `
                    <div class="deal-card" onclick="App.showDealDetail(${d.id})">
                        <div class="deal-name">${d.name}</div>
                        <div class="deal-company">${d.company}</div>
                        <div class="deal-amount">₩${(d.amount / 10000).toLocaleString()}만</div>
                        <div class="deal-meta">
                            <span>${d.owner}</span>
                            <span>${d.probability}% 확률</span>
                        </div>
                    </div>
                `).join('');
            }
        });
    },

    // ==========================================
    // 분석 & 리포트 렌더링
    // ==========================================
    renderAnalytics() {
        this.renderCorrelationChart();
        this.renderSegmentChart();
        this.renderFunnelChart();
        this.renderWeeklyReport();
    },

    renderCorrelationChart() {
        const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        ChartEngine.lineChart('correlationChart', {
            labels: months,
            datasets: [
                { label: '매출(백만)', data: [1800, 2100, 2450, 2600, 2750, 2900, 3100, 3000, 3150, 3350, 3250, 3600], color: '#4a7cff', fill: true },
                { label: '마케팅비(백만)', data: [200, 250, 280, 300, 320, 310, 350, 340, 360, 380, 370, 400], color: '#fbbf24' }
            ]
        });
    },

    renderSegmentChart() {
        ChartEngine.doughnutChart('segmentChart', {
            labels: ['엔터프라이즈', 'SMB', '스타트업', '공공기관', '기타'],
            data: [45, 25, 15, 10, 5]
        });
    },

    renderFunnelChart() {
        const funnel = document.getElementById('funnelChart');
        if (!funnel) return;

        const stages = [
            { label: '웹사이트 방문', value: 15000, width: 100, color: '#4a7cff' },
            { label: '리드 생성', value: 2800, width: 80, color: '#6b99ff' },
            { label: 'MQL', value: 1200, width: 60, color: '#a78bfa' },
            { label: 'SQL', value: 580, width: 45, color: '#fbbf24' },
            { label: '제안', value: 240, width: 32, color: '#fb923c' },
            { label: '계약', value: 85, width: 22, color: '#34d399' }
        ];

        funnel.innerHTML = stages.map(s => `
            <div class="funnel-step">
                <span class="funnel-label">${s.label}</span>
                <div class="funnel-bar" style="width:${s.width}%;background:${s.color}">${s.value.toLocaleString()}</div>
                <span class="funnel-value">${s.value.toLocaleString()}</span>
            </div>
        `).join('');
    },

    renderWeeklyReport() {
        const report = document.getElementById('weeklyReport');
        if (!report) return;

        const items = [
            { title: '신규 리드', value: '142건', change: '+12%', positive: true },
            { title: '미팅 진행', value: '38건', change: '+8%', positive: true },
            { title: '제안서 발송', value: '15건', change: '-5%', positive: false },
            { title: '계약 체결', value: '4건', change: '+33%', positive: true },
            { title: '마케팅 비용', value: '₩4,200만', change: '-2%', positive: true },
            { title: '평균 딜 크기', value: '₩2.3억', change: '+15%', positive: true }
        ];

        report.innerHTML = items.map(item => `
            <div class="report-item">
                <h4>${item.title}</h4>
                <div class="value">${item.value}</div>
                <div class="change" style="color:${item.positive ? '#34d399' : '#f87171'}">
                    ${item.positive ? '▲' : '▼'} ${item.change} 전주 대비
                </div>
            </div>
        `).join('');
    },

    // ==========================================
    // 샥즈 매거진 렌더링
    // ==========================================
    CATEGORY_META: {
        product:   { label: '신제품',     color: '#4a7cff', icon: '◆' },
        review:    { label: '리뷰',       color: '#34d399', icon: '★' },
        tech:      { label: '기술',       color: '#a78bfa', icon: '⚛' },
        sports:    { label: '스포츠',     color: '#fbbf24', icon: '🏃' },
        marketing: { label: '마케팅',     color: '#f87171', icon: '📢' },
        press:     { label: '보도/IR',    color: '#22d3ee', icon: '📰' },
        community: { label: '커뮤니티',   color: '#fb923c', icon: '💬' }
    },

    renderMagazine() {
        if (!this.data.articles) return;
        this.renderMagazineStats();
        this.renderMagazineHero();
        this.renderMagazineSubFeatured();
        this.renderMagazineGrid();
        this.renderMagazineSidebar();
        this.applyNaverConfigToForm();
    },

    getFilteredArticles() {
        let list = [...(this.data.articles || [])];
        const { category, query, sort } = this.magState;

        if (category && category !== 'all') {
            list = list.filter(a => a.category === category);
        }
        if (query) {
            const q = query.toLowerCase();
            list = list.filter(a =>
                (a.title || '').toLowerCase().includes(q) ||
                (a.excerpt || '').toLowerCase().includes(q) ||
                (a.source || '').toLowerCase().includes(q) ||
                (a.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }

        if (sort === 'popular') {
            list.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else if (sort === 'featured') {
            const order = { hero: 0, sub: 1 };
            list.sort((a, b) => (order[a.featured] ?? 9) - (order[b.featured] ?? 9));
        } else {
            list.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return list;
    },

    renderMagazineStats() {
        const articles = this.data.articles || [];
        this.setText('magTotalCount', articles.length.toLocaleString());

        const today = new Date().toISOString().split('T')[0];
        const todayCount = articles.filter(a => (a.daysAgo === 0) || a.date === today).length;
        this.setText('magTodayCount', todayCount.toLocaleString());

        const sources = new Set(articles.map(a => a.source));
        this.setText('magSourceCount', sources.size.toLocaleString());

        const totalViews = articles.reduce((s, a) => s + (a.views || 0), 0);
        this.setText('magViewCount', totalViews >= 10000
            ? (totalViews / 10000).toFixed(1) + '만'
            : totalViews.toLocaleString());

        const positive = articles.filter(a => a.sentiment === 'positive').length;
        const ratio = articles.length ? Math.round(positive / articles.length * 100) : 0;
        this.setText('magSentiment', ratio + '%');
    },

    // 카테고리별 그라디언트 (가짜 썸네일)
    getCategoryGradient(cat) {
        const map = {
            product:   'linear-gradient(135deg, #1e3a8a 0%, #4a7cff 50%, #6b99ff 100%)',
            review:    'linear-gradient(135deg, #064e3b 0%, #34d399 50%, #6ee7b7 100%)',
            tech:      'linear-gradient(135deg, #4c1d95 0%, #a78bfa 50%, #c4b5fd 100%)',
            sports:    'linear-gradient(135deg, #78350f 0%, #fbbf24 50%, #fcd34d 100%)',
            marketing: 'linear-gradient(135deg, #7f1d1d 0%, #f87171 50%, #fca5a5 100%)',
            press:     'linear-gradient(135deg, #134e4a 0%, #22d3ee 50%, #67e8f9 100%)',
            community: 'linear-gradient(135deg, #7c2d12 0%, #fb923c 50%, #fdba74 100%)'
        };
        return map[cat] || 'linear-gradient(135deg, #1f2937, #4a7cff)';
    },

    // 카테고리 칩 HTML
    catChipHTML(cat) {
        const m = this.CATEGORY_META[cat] || { label: cat, color: '#888' };
        return `<span class="mag-cat-chip" style="background:${m.color}">${m.label}</span>`;
    },

    // 매체 칩 HTML
    sourceChipHTML(article) {
        const color = article.sourceColor || '#8b90a0';
        return `<span class="mag-source-chip"><span class="mag-source-dot" style="background:${color}"></span>${this.escapeHTML(article.source)}</span>`;
    },

    // 안전한 텍스트
    escapeHTML(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    formatDateLabel(article) {
        if (article.daysAgo === 0) return '오늘';
        if (article.daysAgo === 1) return '1일 전';
        if (typeof article.daysAgo === 'number' && article.daysAgo < 30) return `${article.daysAgo}일 전`;
        return article.date || '';
    },

    renderMagazineHero() {
        const el = document.getElementById('magHero');
        if (!el) return;
        const articles = this.data.articles || [];
        const hero = articles.find(a => a.featured === 'hero')
            || [...articles].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
        if (!hero) { el.innerHTML = ''; return; }

        el.style.cursor = 'pointer';
        el.onclick = () => this.showArticleDetail(hero.id);
        el.innerHTML = `
            <div class="mag-hero-image" style="background-image:${this.getCategoryGradient(hero.category)}">
                <span class="mag-hero-watermark">SHOKZ</span>
                <div style="position:absolute;top:18px;left:18px;z-index:2">${this.catChipHTML(hero.category)}</div>
            </div>
            <div class="mag-hero-body">
                <div class="mag-hero-meta">
                    ${this.sourceChipHTML(hero)}
                    <span class="mag-meta-dot">·</span>
                    <span style="font-size:12px;color:var(--text-muted)">${this.formatDateLabel(hero)}</span>
                    <span class="mag-meta-dot">·</span>
                    <span style="font-size:12px;color:var(--text-muted)">조회 ${(hero.views || 0).toLocaleString()}</span>
                </div>
                <h2 class="mag-hero-title">${this.escapeHTML(hero.title)}</h2>
                <p class="mag-hero-excerpt">${this.escapeHTML(hero.excerpt)}</p>
                <div class="mag-hero-footer">
                    <span>by ${this.escapeHTML(hero.author || '편집부')}</span>
                    <span class="mag-meta-dot">·</span>
                    <span>${(hero.tags || []).map(t => '#' + t).join(' ')}</span>
                </div>
            </div>
        `;
    },

    renderMagazineSubFeatured() {
        const el = document.getElementById('magSubFeatured');
        if (!el) return;
        const articles = this.data.articles || [];
        const subs = articles.filter(a => a.featured === 'sub').slice(0, 3);
        // 부족하면 인기순으로 채움
        if (subs.length < 3) {
            const fill = [...articles]
                .filter(a => a.featured !== 'hero' && !subs.includes(a))
                .sort((a, b) => (b.views || 0) - (a.views || 0))
                .slice(0, 3 - subs.length);
            subs.push(...fill);
        }

        el.innerHTML = subs.map(a => `
            <article class="mag-sub-card" onclick="App.showArticleDetail(${a.id})">
                <div class="mag-sub-image" style="background-image:${this.getCategoryGradient(a.category)}">
                    <div class="mag-sub-cat">${this.catChipHTML(a.category)}</div>
                </div>
                <div class="mag-sub-body">
                    <h4 class="mag-sub-title">${this.escapeHTML(a.title)}</h4>
                    <p class="mag-sub-excerpt">${this.escapeHTML(a.excerpt)}</p>
                    <div class="mag-sub-footer">
                        ${this.sourceChipHTML(a)}
                        <span>${this.formatDateLabel(a)}</span>
                    </div>
                </div>
            </article>
        `).join('');
    },

    renderMagazineGrid() {
        const grid = document.getElementById('magGrid');
        const empty = document.getElementById('magEmpty');
        const countEl = document.getElementById('magGridCount');
        const titleEl = document.getElementById('magGridTitle');
        if (!grid) return;

        const filtered = this.getFilteredArticles();
        // 그리드는 hero/sub 제외 (필터 활성 시는 모두 표시)
        const isFiltered = this.magState.category !== 'all' || this.magState.query;
        const list = isFiltered
            ? filtered
            : filtered.filter(a => a.featured !== 'hero' && a.featured !== 'sub');

        // 타이틀
        if (titleEl) {
            const cat = this.magState.category;
            titleEl.textContent = (cat === 'all')
                ? (this.magState.query ? `"${this.magState.query}" 검색 결과` : '최신 클리핑')
                : (this.CATEGORY_META[cat]?.label || cat) + ' 클리핑';
        }
        if (countEl) countEl.textContent = list.length ? `${list.length}건` : '';

        if (!list.length) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        grid.innerHTML = list.map(a => `
            <article class="mag-card" onclick="App.showArticleDetail(${a.id})">
                <div class="mag-card-image" style="background-image:${this.getCategoryGradient(a.category)}">
                    <div class="mag-card-cat">${this.catChipHTML(a.category)}</div>
                </div>
                <div class="mag-card-body">
                    <h4 class="mag-card-title">${this.escapeHTML(a.title)}</h4>
                    <p class="mag-card-excerpt">${this.escapeHTML(a.excerpt)}</p>
                    <div class="mag-card-footer">
                        ${this.sourceChipHTML(a)}
                        <span>${this.formatDateLabel(a)} · ${(a.views || 0).toLocaleString()}</span>
                    </div>
                </div>
            </article>
        `).join('');
    },

    renderMagazineSidebar() {
        const articles = this.data.articles || [];

        // 매체별 카운트
        const sourceList = document.getElementById('magSourceList');
        if (sourceList) {
            const counts = {};
            const colors = {};
            articles.forEach(a => {
                counts[a.source] = (counts[a.source] || 0) + 1;
                colors[a.source] = a.sourceColor || '#8b90a0';
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
            const max = sorted[0]?.[1] || 1;
            sourceList.innerHTML = sorted.map(([name, count]) => `
                <div class="mag-source-row">
                    <span class="mag-source-name" title="${this.escapeHTML(name)}">${this.escapeHTML(name)}</span>
                    <div class="mag-source-bar-track">
                        <div class="mag-source-bar-fill" style="width:${(count / max) * 100}%;background:${colors[name]}"></div>
                    </div>
                    <span class="mag-source-count-num">${count}</span>
                </div>
            `).join('');
        }

        // 트렌딩 태그
        const tagsEl = document.getElementById('magTrendingTags');
        if (tagsEl) {
            const tagCount = {};
            articles.forEach(a => (a.tags || []).forEach(t => {
                tagCount[t] = (tagCount[t] || 0) + 1;
            }));
            const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 16);
            tagsEl.innerHTML = sorted.map(([tag, c], i) => `
                <span class="mag-tag ${i < 3 ? 'mag-tag-hot' : ''}" onclick="App.searchByTag('${this.escapeHTML(tag)}')">#${this.escapeHTML(tag)} <small>${c}</small></span>
            `).join('');
        }

        // 실시간 피드 (최신 7개)
        const feed = document.getElementById('magLiveFeed');
        if (feed) {
            const latest = [...articles].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);
            feed.innerHTML = latest.map(a => `
                <div class="mag-feed-item" onclick="App.showArticleDetail(${a.id})">
                    <div class="mag-feed-title">${this.escapeHTML(a.title)}</div>
                    <div class="mag-feed-meta">${this.escapeHTML(a.source)} · ${this.formatDateLabel(a)}</div>
                </div>
            `).join('');
        }
    },

    searchByTag(tag) {
        this.magState.query = tag;
        const input = document.getElementById('magSearchInput');
        if (input) input.value = tag;
        this.renderMagazineGrid();
    },

    showArticleDetail(id) {
        const a = (this.data.articles || []).find(x => x.id === id);
        if (!a) return;
        const modal = document.getElementById('modalContent');
        const overlay = document.getElementById('modalOverlay');

        const sentimentMap = { positive: '긍정', neutral: '중립', negative: '부정' };
        const sentimentColor = { positive: 'var(--accent-green)', neutral: 'var(--accent-yellow)', negative: 'var(--accent-red)' };

        modal.innerHTML = `
            <div class="modal-header">
                <h3>기사 상세</h3>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="mag-detail-image" style="background-image:${this.getCategoryGradient(a.category)}">
                    <span class="mag-hero-watermark">SHOKZ</span>
                </div>
                <div class="mag-detail-meta-row">
                    ${this.catChipHTML(a.category)}
                    ${this.sourceChipHTML(a)}
                    <span style="font-size:12px;color:var(--text-muted)">${a.date || ''}</span>
                    <span class="mag-meta-dot">·</span>
                    <span style="font-size:12px;color:var(--text-muted)">조회 ${(a.views || 0).toLocaleString()}</span>
                    <span class="mag-meta-dot">·</span>
                    <span style="font-size:12px;color:${sentimentColor[a.sentiment] || 'var(--text-muted)'}">감성 ${sentimentMap[a.sentiment] || '-'}</span>
                </div>
                <h2 class="mag-detail-title">${this.escapeHTML(a.title)}</h2>
                <p class="mag-detail-excerpt">${this.escapeHTML(a.excerpt)}</p>
                <div class="mag-detail-tags">
                    ${(a.tags || []).map(t => `<span class="mag-tag">#${this.escapeHTML(t)}</span>`).join('')}
                </div>
                <div style="font-size:12px;color:var(--text-muted)">기자/작성자: ${this.escapeHTML(a.author || '-')}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="App.deleteArticle(${a.id})">클리핑 삭제</button>
                ${a.url ? `<a class="btn btn-outline" href="${this.escapeHTML(a.url)}" target="_blank" rel="noopener">원문 보기 ↗</a>` : ''}
                <button class="btn btn-primary" onclick="App.closeModal()">닫기</button>
            </div>
        `;
        overlay.classList.add('active');
    },

    deleteArticle(id) {
        if (!confirm('이 클리핑을 삭제하시겠습니까?')) return;
        this.data.articles = (this.data.articles || []).filter(a => a.id !== id);
        DataStore.save(this.data);
        this.closeModal();
        this.renderMagazine();
    },

    // ==========================================
    // 네이버 뉴스 검색 API 연동
    // ==========================================
    openNaverPanel() {
        const panel = document.getElementById('magNaverPanel');
        if (panel) panel.classList.add('active');
        this.applyNaverConfigToForm();
    },

    closeNaverPanel() {
        const panel = document.getElementById('magNaverPanel');
        if (panel) panel.classList.remove('active');
    },

    applyNaverConfigToForm() {
        const cfg = this.data.naverConfig || {};
        const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
        setVal('naverScriptUrl', cfg.scriptUrl || '');
        setVal('naverQuery', cfg.query || '샥즈 코리아');
        setVal('naverDisplay', cfg.display || 20);

        const channels = cfg.channels || ['news', 'blog', 'cafe'];
        const setChk = (id, on) => { const el = document.getElementById(id); if (el) el.checked = !!on; };
        setChk('naverChNews', channels.includes('news'));
        setChk('naverChBlog', channels.includes('blog'));
        setChk('naverChCafe', channels.includes('cafe'));
        // strict는 명시적으로 false일 때만 해제, 그 외 기본 true
        setChk('naverStrict', cfg.strict !== false);

        const status = document.getElementById('naverStatus');
        if (status && cfg.lastFetched) {
            status.className = 'mag-naver-status';
            status.textContent = `최근 동기화: ${cfg.lastFetched}`;
        }
    },

    readNaverForm() {
        const channels = [];
        if (document.getElementById('naverChNews')?.checked) channels.push('news');
        if (document.getElementById('naverChBlog')?.checked) channels.push('blog');
        if (document.getElementById('naverChCafe')?.checked) channels.push('cafe');
        return {
            scriptUrl: document.getElementById('naverScriptUrl')?.value.trim() || '',
            query: document.getElementById('naverQuery')?.value.trim() || '샥즈 코리아',
            display: Math.min(100, Math.max(1, parseInt(document.getElementById('naverDisplay')?.value, 10) || 20)),
            channels,
            strict: !!document.getElementById('naverStrict')?.checked
        };
    },

    saveNaverConfig() {
        const form = this.readNaverForm();
        this.data.naverConfig = {
            ...form,
            lastFetched: this.data.naverConfig?.lastFetched || null
        };
        DataStore.save(this.data);
        this.setNaverStatus('설정이 저장되었습니다.', 'success');
    },

    setNaverStatus(msg, type = '') {
        const el = document.getElementById('naverStatus');
        if (!el) return;
        el.textContent = msg;
        el.className = 'mag-naver-status' + (type ? ' ' + type : '');
    },

    async fetchNaverNews() {
        const { scriptUrl, query, display, channels, strict } = this.readNaverForm();

        if (!scriptUrl) {
            this.setNaverStatus('Apps Script Web App URL을 입력하세요.', 'error');
            return;
        }
        if (!/^https:\/\/script\.google\.com\//i.test(scriptUrl)) {
            this.setNaverStatus('Apps Script URL 형식이 올바르지 않습니다 (script.google.com 으로 시작).', 'error');
            return;
        }
        if (!channels.length) {
            this.setNaverStatus('수집 채널을 1개 이상 선택하세요.', 'error');
            return;
        }

        this.setNaverStatus(`네이버 ${channels.join(' · ')} 검색 중${strict ? ' (정확도 필터 ON)' : ''}...`, 'loading');

        const url = scriptUrl
            + (scriptUrl.includes('?') ? '&' : '?')
            + 'query=' + encodeURIComponent(query)
            + '&display=' + display
            + '&channels=' + encodeURIComponent(channels.join(','))
            + '&strict=' + (strict ? 'true' : 'false');

        try {
            // Apps Script 웹 앱은 리다이렉트(302)를 거치므로 redirect: 'follow' 명시
            const res = await fetch(url, { method: 'GET', redirect: 'follow' });
            if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            const added = this.mergeNaverItems(json.items || []);
            const ts = new Date().toLocaleString('ko-KR');
            this.data.naverConfig = { ...this.readNaverForm(), lastFetched: ts };
            DataStore.save(this.data);

            const counts = json.counts || {};
            const fc = json.filteredCounts || {};
            const breakdown = Object.keys(counts)
                .map(k => fc[k] !== undefined ? `${k}:${fc[k]}/${counts[k]}` : `${k}:${counts[k]}`)
                .join(' · ');
            const droppedNote = json.droppedByRelevance
                ? ` · 노이즈 제외 ${json.droppedByRelevance}건`
                : '';
            this.setNaverStatus(
                `✓ 총 ${json.total || 0}건 수신 (${breakdown})${droppedNote}, 신규 ${added}건 추가 · ${ts}`,
                'success'
            );
            this.renderMagazine();
        } catch (err) {
            console.error('Apps Script fetch error:', err);
            this.setNaverStatus(`✗ 호출 실패: ${err.message} — Apps Script 배포 권한이 "모든 사용자"인지 확인하세요.`, 'error');
        }
    },

    // Apps Script가 이미 정규화한 items[] → 매거진 article로 병합
    mergeNaverItems(items) {
        if (!Array.isArray(items) || !items.length) return 0;
        this.data.articles = this.data.articles || [];

        const existingTitles = new Set(this.data.articles.map(a => a.title));
        const existingUrls = new Set(this.data.articles.map(a => a.url).filter(Boolean));
        let nextId = (this.data.articles.reduce((m, a) => Math.max(m, typeof a.id === 'number' ? a.id : 0), 0)) + 1;
        let added = 0;

        items.forEach(it => {
            const title = (it.title || '').trim();
            if (!title) return;
            if (existingTitles.has(title)) return;
            if (it.url && existingUrls.has(it.url)) return;

            const date = it.date || new Date().toISOString().slice(0, 10);
            const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));

            this.data.articles.push({
                id: nextId++,
                category: it.category || 'press',
                title,
                excerpt: it.excerpt || '',
                source: it.source || '네이버',
                sourceColor: it.sourceColor || '#03c75a',
                date, daysAgo,
                views: 0,
                sentiment: it.sentiment || 'neutral',
                tags: Array.isArray(it.tags) ? it.tags : [],
                type: it.type || 'news',
                author: it.author || it.bloggerName || it.cafeName || '편집부',
                url: it.url || '',
                channel: it.channel,
                source_origin: 'apps-script'
            });
            existingTitles.add(title);
            if (it.url) existingUrls.add(it.url);
            added++;
        });

        DataStore.save(this.data);
        return added;
    },

    // ==========================================
    // 모달 관리
    // ==========================================
    showModal(type) {
        const modal = document.getElementById('modalContent');
        const overlay = document.getElementById('modalOverlay');

        let html = '';
        switch (type) {
            case 'campaign':
                html = this.getCampaignModalHTML();
                break;
            case 'salesPlan':
                html = this.getSalesPlanModalHTML();
                break;
            case 'deal':
                html = this.getDealModalHTML();
                break;
            case 'clipping':
                html = this.getClippingModalHTML();
                break;
        }

        modal.innerHTML = html;
        overlay.classList.add('active');
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    },

    getCampaignModalHTML() {
        return `
            <div class="modal-header">
                <h3>새 캠페인 등록</h3>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>캠페인명</label>
                    <input type="text" class="form-input" id="campaignName" placeholder="캠페인 이름을 입력하세요">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>채널</label>
                        <select class="form-input" id="campaignChannel">
                            <option value="digital">디지털 마케팅</option>
                            <option value="social">소셜 미디어</option>
                            <option value="content">콘텐츠 마케팅</option>
                            <option value="event">이벤트 & PR</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>예산 (원)</label>
                        <input type="number" class="form-input" id="campaignBudget" placeholder="예산을 입력하세요">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>시작일</label>
                        <input type="date" class="form-input" id="campaignStart">
                    </div>
                    <div class="form-group">
                        <label>종료일</label>
                        <input type="date" class="form-input" id="campaignEnd">
                    </div>
                </div>
                <div class="form-group">
                    <label>설명</label>
                    <textarea class="form-input" id="campaignDesc" placeholder="캠페인 설명을 입력하세요"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="App.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="App.saveCampaign()">등록</button>
            </div>
        `;
    },

    getSalesPlanModalHTML() {
        return `
            <div class="modal-header">
                <h3>새 영업 계획</h3>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>계획명</label>
                    <input type="text" class="form-input" id="planName" placeholder="영업 계획 이름">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>담당자</label>
                        <input type="text" class="form-input" id="planManager" placeholder="담당자명">
                    </div>
                    <div class="form-group">
                        <label>목표 매출 (원)</label>
                        <input type="number" class="form-input" id="planTarget" placeholder="목표 매출">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>시작일</label>
                        <input type="date" class="form-input" id="planStart">
                    </div>
                    <div class="form-group">
                        <label>종료일</label>
                        <input type="date" class="form-input" id="planEnd">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="App.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="App.saveSalesPlan()">등록</button>
            </div>
        `;
    },

    getClippingModalHTML() {
        return `
            <div class="modal-header">
                <h3>+ 수동 클리핑 추가</h3>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>제목 *</label>
                    <input type="text" class="form-input" id="clipTitle" placeholder="기사 제목">
                </div>
                <div class="form-group">
                    <label>요약</label>
                    <textarea class="form-input" id="clipExcerpt" placeholder="기사 요약 또는 첫 문단"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>매체명 *</label>
                        <input type="text" class="form-input" id="clipSource" placeholder="예) 지디넷코리아">
                    </div>
                    <div class="form-group">
                        <label>매체 컬러 (HEX)</label>
                        <input type="text" class="form-input" id="clipSourceColor" value="#4a7cff">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>카테고리</label>
                        <select class="form-input" id="clipCategory">
                            <option value="product">신제품</option>
                            <option value="review">리뷰</option>
                            <option value="tech">기술</option>
                            <option value="sports">스포츠</option>
                            <option value="marketing">마케팅</option>
                            <option value="press">보도/IR</option>
                            <option value="community">커뮤니티</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>발행일</label>
                        <input type="date" class="form-input" id="clipDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>원문 URL</label>
                        <input type="text" class="form-input" id="clipUrl" placeholder="https://">
                    </div>
                    <div class="form-group">
                        <label>태그 (쉼표 구분)</label>
                        <input type="text" class="form-input" id="clipTags" placeholder="예) OpenRun, 골전도">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>감성</label>
                        <select class="form-input" id="clipSentiment">
                            <option value="positive">긍정</option>
                            <option value="neutral">중립</option>
                            <option value="negative">부정</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>피처드</label>
                        <select class="form-input" id="clipFeatured">
                            <option value="">일반</option>
                            <option value="sub">서브 피처드</option>
                            <option value="hero">히어로</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="App.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="App.saveClipping()">클리핑 추가</button>
            </div>
        `;
    },

    saveClipping() {
        const title = document.getElementById('clipTitle')?.value.trim();
        const source = document.getElementById('clipSource')?.value.trim();
        if (!title || !source) {
            alert('제목과 매체명은 필수 항목입니다.');
            return;
        }
        const tagsRaw = document.getElementById('clipTags')?.value || '';
        const date = document.getElementById('clipDate')?.value || new Date().toISOString().split('T')[0];
        const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));

        const article = {
            id: ((this.data.articles || []).reduce((m, a) => Math.max(m, a.id || 0), 0)) + 1,
            featured: document.getElementById('clipFeatured')?.value || undefined,
            category: document.getElementById('clipCategory')?.value || 'press',
            title,
            excerpt: document.getElementById('clipExcerpt')?.value.trim() || '',
            source,
            sourceColor: document.getElementById('clipSourceColor')?.value.trim() || '#4a7cff',
            date, daysAgo,
            views: 0,
            sentiment: document.getElementById('clipSentiment')?.value || 'neutral',
            tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
            type: 'manual',
            author: '수동 클리핑',
            url: document.getElementById('clipUrl')?.value.trim() || ''
        };

        this.data.articles = this.data.articles || [];
        this.data.articles.unshift(article);
        DataStore.save(this.data);
        this.closeModal();
        this.renderMagazine();
    },

    getDealModalHTML() {
        return `
            <div class="modal-header">
                <h3>새 딜 등록</h3>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>딜 이름</label>
                    <input type="text" class="form-input" id="dealName" placeholder="프로젝트/딜 이름">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>회사명</label>
                        <input type="text" class="form-input" id="dealCompany" placeholder="고객사명">
                    </div>
                    <div class="form-group">
                        <label>금액 (원)</label>
                        <input type="number" class="form-input" id="dealAmount" placeholder="딜 규모">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>단계</label>
                        <select class="form-input" id="dealStage">
                            <option value="lead">리드 발굴</option>
                            <option value="contact">접촉 / 미팅</option>
                            <option value="proposal">제안 / 견적</option>
                            <option value="negotiation">협상</option>
                            <option value="closed">계약 완료</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>담당자</label>
                        <input type="text" class="form-input" id="dealOwner" placeholder="담당 영업사원">
                    </div>
                </div>
                <div class="form-group">
                    <label>성공 확률 (%)</label>
                    <input type="number" class="form-input" id="dealProbability" min="0" max="100" placeholder="0-100">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="App.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="App.saveDeal()">등록</button>
            </div>
        `;
    },

    // ==========================================
    // CRUD 동작
    // ==========================================
    saveCampaign() {
        const name = document.getElementById('campaignName')?.value;
        const channel = document.getElementById('campaignChannel')?.value;
        const budget = parseInt(document.getElementById('campaignBudget')?.value) || 0;
        const startDate = document.getElementById('campaignStart')?.value;
        const endDate = document.getElementById('campaignEnd')?.value;

        if (!name || !budget || !startDate || !endDate) {
            alert('모든 필수 항목을 입력해주세요.');
            return;
        }

        const newCampaign = {
            id: Math.max(...this.data.campaigns.map(c => c.id)) + 1,
            name, channel, status: 'pending', budget, spent: 0, roi: 0,
            startDate, endDate, progress: 0
        };

        this.data.campaigns.push(newCampaign);
        DataStore.save(this.data);
        this.closeModal();
        this.refreshCurrentView();
    },

    saveSalesPlan() {
        const name = document.getElementById('planName')?.value;
        const manager = document.getElementById('planManager')?.value;
        const targetRevenue = parseInt(document.getElementById('planTarget')?.value) || 0;
        const startDate = document.getElementById('planStart')?.value;
        const endDate = document.getElementById('planEnd')?.value;

        if (!name || !manager || !targetRevenue || !startDate || !endDate) {
            alert('모든 필수 항목을 입력해주세요.');
            return;
        }

        const newPlan = {
            id: Math.max(...this.data.salesPlans.map(p => p.id)) + 1,
            name, manager, startDate, endDate, targetRevenue,
            achievedRevenue: 0, status: 'pending'
        };

        this.data.salesPlans.push(newPlan);
        DataStore.save(this.data);
        this.closeModal();
        this.refreshCurrentView();
    },

    saveDeal() {
        const name = document.getElementById('dealName')?.value;
        const company = document.getElementById('dealCompany')?.value;
        const amount = parseInt(document.getElementById('dealAmount')?.value) || 0;
        const stage = document.getElementById('dealStage')?.value;
        const owner = document.getElementById('dealOwner')?.value;
        const probability = parseInt(document.getElementById('dealProbability')?.value) || 0;

        if (!name || !company || !amount || !owner) {
            alert('모든 필수 항목을 입력해주세요.');
            return;
        }

        const newDeal = {
            id: Math.max(...this.data.deals.map(d => d.id)) + 1,
            name, company, amount, stage, probability, owner, daysInStage: 0
        };

        this.data.deals.push(newDeal);
        DataStore.save(this.data);
        this.closeModal();
        this.refreshCurrentView();
    },

    editSalesPlan(id) {
        const plan = this.data.salesPlans.find(p => p.id === id);
        if (!plan) return;

        this.showModal('salesPlan');
        setTimeout(() => {
            const nameEl = document.getElementById('planName');
            if (nameEl) nameEl.value = plan.name;
            const mgrEl = document.getElementById('planManager');
            if (mgrEl) mgrEl.value = plan.manager;
            const targetEl = document.getElementById('planTarget');
            if (targetEl) targetEl.value = plan.targetRevenue;
            const startEl = document.getElementById('planStart');
            if (startEl) startEl.value = plan.startDate;
            const endEl = document.getElementById('planEnd');
            if (endEl) endEl.value = plan.endDate;

            // 모달 제목 및 버튼 변경
            const header = document.querySelector('.modal-header h3');
            if (header) header.textContent = '영업 계획 수정';
            const saveBtn = document.querySelector('.modal-footer .btn-primary');
            if (saveBtn) {
                saveBtn.textContent = '저장';
                saveBtn.onclick = () => {
                    plan.name = document.getElementById('planName')?.value || plan.name;
                    plan.manager = document.getElementById('planManager')?.value || plan.manager;
                    plan.targetRevenue = parseInt(document.getElementById('planTarget')?.value) || plan.targetRevenue;
                    plan.startDate = document.getElementById('planStart')?.value || plan.startDate;
                    plan.endDate = document.getElementById('planEnd')?.value || plan.endDate;
                    DataStore.save(this.data);
                    this.closeModal();
                    this.refreshCurrentView();
                };
            }
        }, 50);
    },

    showDealDetail(id) {
        const deal = this.data.deals.find(d => d.id === id);
        if (!deal) return;

        const stageNames = { lead: '리드 발굴', contact: '접촉', proposal: '제안', negotiation: '협상', closed: '계약 완료' };
        const modal = document.getElementById('modalContent');
        const overlay = document.getElementById('modalOverlay');

        modal.innerHTML = `
            <div class="modal-header">
                <h3>${deal.name}</h3>
                <button class="modal-close" onclick="App.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                    <div class="report-item">
                        <h4>고객사</h4>
                        <div class="value" style="font-size:16px">${deal.company}</div>
                    </div>
                    <div class="report-item">
                        <h4>금액</h4>
                        <div class="value" style="font-size:16px;color:#4a7cff">₩${(deal.amount / 10000).toLocaleString()}만</div>
                    </div>
                    <div class="report-item">
                        <h4>현재 단계</h4>
                        <div class="value" style="font-size:16px">${stageNames[deal.stage]}</div>
                    </div>
                    <div class="report-item">
                        <h4>성공 확률</h4>
                        <div class="value" style="font-size:16px">${deal.probability}%</div>
                    </div>
                    <div class="report-item">
                        <h4>담당자</h4>
                        <div class="value" style="font-size:16px">${deal.owner}</div>
                    </div>
                    <div class="report-item">
                        <h4>단계 체류일</h4>
                        <div class="value" style="font-size:16px">${deal.daysInStage}일</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="App.deleteDeal(${deal.id})">삭제</button>
                <button class="btn btn-outline" onclick="App.closeModal()">닫기</button>
            </div>
        `;
        overlay.classList.add('active');
    },

    deleteDeal(id) {
        if (!confirm('이 딜을 삭제하시겠습니까?')) return;
        this.data.deals = this.data.deals.filter(d => d.id !== id);
        DataStore.save(this.data);
        this.closeModal();
        this.refreshCurrentView();
    },

    // ==========================================
    // 알림
    // ==========================================
    renderNotifications() {
        const list = document.getElementById('notifList');
        if (!list) return;

        list.innerHTML = this.data.notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}">
                <div class="notif-title">${n.title}</div>
                <div class="notif-desc">${n.desc}</div>
                <div class="notif-time">${n.time}</div>
            </div>
        `).join('');

        const unread = this.data.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notifCount');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    },

    clearNotifications() {
        this.data.notifications.forEach(n => n.read = true);
        DataStore.save(this.data);
        this.renderNotifications();
    },

    // ==========================================
    // 유틸리티
    // ==========================================
    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    handleSearch(query) {
        // 간단한 글로벌 검색 구현
        if (!query || query.length < 2) return;
        console.log('Search:', query);
    },

    exportData(type) {
        const filename = `eulpeul_${type}_${new Date().toISOString().split('T')[0]}.json`;
        let exportData;
        switch (type) {
            case 'sales': exportData = this.data.salesPlans; break;
            case 'pipeline': exportData = this.data.deals; break;
            case 'analytics': exportData = { campaigns: this.data.campaigns, revenue: this.data.revenueData }; break;
            default: exportData = this.data;
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    startAutoRefresh() {
        // 5분마다 데이터 갱신 (실제 운영 시 API 연동)
        setInterval(() => {
            const autoRefresh = document.getElementById('autoRefreshToggle');
            if (autoRefresh && autoRefresh.checked) {
                this.refreshCurrentView();
            }
        }, 300000);
    }
};

// 앱 시작
document.addEventListener('DOMContentLoaded', () => App.init());
