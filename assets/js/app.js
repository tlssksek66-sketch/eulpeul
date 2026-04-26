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
        // 네비게이션 (외부 링크는 기본 이동 허용)
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.external === 'true') return;
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
    },

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
