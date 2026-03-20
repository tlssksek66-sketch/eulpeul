/**
 * DataStore - 영업/IMC 데이터 관리
 * localStorage 기반 영속적 데이터 저장소
 */
const DataStore = {
    STORAGE_KEY: 'eulpeul_data',

    /**
     * 초기 샘플 데이터
     */
    defaultData: {
        // 영업 계획
        salesPlans: [
            { id: 1, name: 'Q1 신규 고객 확보', manager: '김영업', startDate: '2026-01-01', endDate: '2026-03-31', targetRevenue: 800000000, achievedRevenue: 624000000, status: 'active' },
            { id: 2, name: 'B2B 엔터프라이즈 공략', manager: '이전략', startDate: '2026-01-15', endDate: '2026-06-30', targetRevenue: 1500000000, achievedRevenue: 540000000, status: 'active' },
            { id: 3, name: 'SMB 시장 확대', manager: '박성과', startDate: '2026-02-01', endDate: '2026-04-30', targetRevenue: 450000000, achievedRevenue: 297000000, status: 'active' },
            { id: 4, name: '기존 고객 업셀링', manager: '최관리', startDate: '2026-01-01', endDate: '2026-02-28', targetRevenue: 300000000, achievedRevenue: 312000000, status: 'completed' },
            { id: 5, name: '파트너십 프로그램', manager: '정협력', startDate: '2026-03-01', endDate: '2026-05-31', targetRevenue: 600000000, achievedRevenue: 120000000, status: 'active' },
            { id: 6, name: '해외 시장 진출', manager: '강글로벌', startDate: '2026-04-01', endDate: '2026-09-30', targetRevenue: 2000000000, achievedRevenue: 0, status: 'pending' },
            { id: 7, name: 'Q4 연말 세일즈', manager: '김영업', startDate: '2025-10-01', endDate: '2025-12-31', targetRevenue: 900000000, achievedRevenue: 945000000, status: 'completed' },
            { id: 8, name: '공공기관 입찰', manager: '이전략', startDate: '2026-02-01', endDate: '2026-07-31', targetRevenue: 1200000000, achievedRevenue: 180000000, status: 'active' },
            { id: 9, name: '리뉴얼 캠페인', manager: '최관리', startDate: '2025-11-01', endDate: '2026-01-31', targetRevenue: 250000000, achievedRevenue: 268000000, status: 'completed' },
            { id: 10, name: '스타트업 생태계 진입', manager: '박성과', startDate: '2026-04-01', endDate: '2026-06-30', targetRevenue: 350000000, achievedRevenue: 0, status: 'pending' },
            { id: 11, name: '제조업 수직 공략', manager: '정협력', startDate: '2025-12-01', endDate: '2026-03-31', targetRevenue: 700000000, achievedRevenue: 588000000, status: 'completed' },
            { id: 12, name: '교육 시장 파일럿', manager: '강글로벌', startDate: '2026-05-01', endDate: '2026-08-31', targetRevenue: 200000000, achievedRevenue: 0, status: 'pending' }
        ],

        // IMC 캠페인
        campaigns: [
            { id: 1, name: '브랜드 리뉴얼 캠페인', channel: 'digital', status: 'active', budget: 120000000, spent: 85000000, roi: 340, startDate: '2026-01-15', endDate: '2026-04-15', progress: 72 },
            { id: 2, name: 'SNS 인플루언서 협업', channel: 'social', status: 'active', budget: 80000000, spent: 55000000, roi: 280, startDate: '2026-02-01', endDate: '2026-03-31', progress: 85 },
            { id: 3, name: '기술 블로그 시리즈', channel: 'content', status: 'active', budget: 30000000, spent: 18000000, roi: 190, startDate: '2026-01-01', endDate: '2026-06-30', progress: 45 },
            { id: 4, name: '산업 컨퍼런스 참가', channel: 'event', status: 'completed', budget: 150000000, spent: 148000000, roi: 210, startDate: '2026-01-20', endDate: '2026-02-20', progress: 100 },
            { id: 5, name: '이메일 너처링 시퀀스', channel: 'digital', status: 'active', budget: 15000000, spent: 8000000, roi: 420, startDate: '2026-02-15', endDate: '2026-05-15', progress: 40 },
            { id: 6, name: '고객 사례 영상 제작', channel: 'content', status: 'active', budget: 50000000, spent: 22000000, roi: 150, startDate: '2026-03-01', endDate: '2026-05-31', progress: 30 },
            { id: 7, name: '페이드 서치 광고', channel: 'digital', status: 'active', budget: 200000000, spent: 142000000, roi: 380, startDate: '2026-01-01', endDate: '2026-12-31', progress: 22 },
            { id: 8, name: '웨비나 시리즈', channel: 'event', status: 'pending', budget: 40000000, spent: 5000000, roi: 0, startDate: '2026-04-01', endDate: '2026-06-30', progress: 10 },
            { id: 9, name: '유튜브 채널 운영', channel: 'social', status: 'active', budget: 60000000, spent: 35000000, roi: 220, startDate: '2026-01-01', endDate: '2026-12-31', progress: 25 },
            { id: 10, name: '리타겟팅 광고', channel: 'digital', status: 'active', budget: 90000000, spent: 67000000, roi: 310, startDate: '2026-02-01', endDate: '2026-07-31', progress: 55 },
            { id: 11, name: '백서/가이드 발행', channel: 'content', status: 'pending', budget: 25000000, spent: 3000000, roi: 0, startDate: '2026-04-01', endDate: '2026-05-31', progress: 8 },
            { id: 12, name: 'PR 보도자료 배포', channel: 'event', status: 'completed', budget: 20000000, spent: 19500000, roi: 180, startDate: '2026-01-10', endDate: '2026-02-10', progress: 100 },
            { id: 13, name: '커뮤니티 마케팅', channel: 'social', status: 'active', budget: 35000000, spent: 20000000, roi: 260, startDate: '2026-02-15', endDate: '2026-08-15', progress: 35 },
            { id: 14, name: 'SEO 최적화 프로젝트', channel: 'content', status: 'active', budget: 45000000, spent: 28000000, roi: 290, startDate: '2026-01-01', endDate: '2026-06-30', progress: 50 }
        ],

        // 영업 파이프라인 딜
        deals: [
            { id: 1, name: 'ERP 시스템 구축', company: '(주)한국제조', amount: 350000000, stage: 'negotiation', probability: 75, owner: '김영업', daysInStage: 12 },
            { id: 2, name: '클라우드 마이그레이션', company: '테크스타 Inc.', amount: 280000000, stage: 'proposal', probability: 50, owner: '이전략', daysInStage: 8 },
            { id: 3, name: '보안 솔루션 도입', company: '세이프가드(주)', amount: 150000000, stage: 'contact', probability: 30, owner: '박성과', daysInStage: 5 },
            { id: 4, name: 'AI 분석 플랫폼', company: '데이터웍스', amount: 520000000, stage: 'proposal', probability: 60, owner: '김영업', daysInStage: 15 },
            { id: 5, name: '전사 CRM 솔루션', company: '글로벌 유통(주)', amount: 420000000, stage: 'negotiation', probability: 80, owner: '최관리', daysInStage: 20 },
            { id: 6, name: '모바일 앱 개발', company: '스마트앱 코리아', amount: 180000000, stage: 'lead', probability: 15, owner: '정협력', daysInStage: 3 },
            { id: 7, name: 'IoT 모니터링', company: '센서텍(주)', amount: 95000000, stage: 'lead', probability: 20, owner: '이전략', daysInStage: 2 },
            { id: 8, name: '데이터 웨어하우스', company: '메가데이터(주)', amount: 680000000, stage: 'contact', probability: 35, owner: '김영업', daysInStage: 7 },
            { id: 9, name: '그룹웨어 커스텀', company: '파인오피스', amount: 120000000, stage: 'closed', probability: 100, owner: '박성과', daysInStage: 0 },
            { id: 10, name: 'WMS 시스템', company: '물류프로(주)', amount: 240000000, stage: 'proposal', probability: 45, owner: '최관리', daysInStage: 10 },
            { id: 11, name: 'HR 시스템 통합', company: '피플테크', amount: 190000000, stage: 'contact', probability: 40, owner: '정협력', daysInStage: 6 },
            { id: 12, name: 'BI 대시보드 구축', company: '인사이트랩', amount: 88000000, stage: 'closed', probability: 100, owner: '김영업', daysInStage: 0 },
            { id: 13, name: '전자결재 시스템', company: '디지페이퍼(주)', amount: 75000000, stage: 'lead', probability: 10, owner: '이전략', daysInStage: 1 },
            { id: 14, name: '컨택센터 솔루션', company: '콜매니저(주)', amount: 310000000, stage: 'negotiation', probability: 70, owner: '박성과', daysInStage: 18 },
            { id: 15, name: '메시지 플랫폼', company: '챗봇코리아', amount: 65000000, stage: 'lead', probability: 25, owner: '최관리', daysInStage: 4 },
            { id: 16, name: '문서관리 시스템', company: '도큐웍스(주)', amount: 140000000, stage: 'closed', probability: 100, owner: '정협력', daysInStage: 0 },
            { id: 17, name: '화상회의 솔루션', company: '비디오미트(주)', amount: 55000000, stage: 'contact', probability: 30, owner: '강글로벌', daysInStage: 9 }
        ],

        // 알림
        notifications: [
            { id: 1, title: '딜 단계 변경', desc: '"전사 CRM 솔루션" 딜이 협상 단계로 이동했습니다.', time: '5분 전', read: false },
            { id: 2, title: '캠페인 목표 달성', desc: '"SNS 인플루언서 협업" 캠페인이 목표 ROI를 달성했습니다.', time: '1시간 전', read: false },
            { id: 3, title: 'KPI 경고', desc: '이번 주 신규 리드 수가 목표 대비 15% 미달입니다.', time: '3시간 전', read: false },
            { id: 4, title: '영업 계획 완료', desc: '"기존 고객 업셀링" 계획이 목표를 104% 달성하여 완료되었습니다.', time: '1일 전', read: true },
            { id: 5, title: '신규 리드 유입', desc: '웹사이트를 통해 5건의 신규 리드가 유입되었습니다.', time: '2일 전', read: true }
        ],

        // 활동 로그
        activities: [
            { text: '"전사 CRM 솔루션" 딜 협상 진행 - 최관리', time: '10분 전', color: '#4a7cff' },
            { text: 'SNS 캠페인 주간 성과 보고서 생성', time: '1시간 전', color: '#34d399' },
            { text: '"AI 분석 플랫폼" 제안서 발송 완료 - 김영업', time: '2시간 전', color: '#a78bfa' },
            { text: '이메일 너처링 A/B 테스트 시작', time: '3시간 전', color: '#fbbf24' },
            { text: '"보안 솔루션 도입" 첫 미팅 완료 - 박성과', time: '4시간 전', color: '#22d3ee' },
            { text: '기술 블로그 새 포스트 발행 (SEO 최적화)', time: '5시간 전', color: '#fb923c' },
            { text: '"B2B 엔터프라이즈 공략" 전략 회의 개최', time: '어제', color: '#4a7cff' },
            { text: '파트너십 MOU 체결 - 정협력', time: '어제', color: '#f87171' }
        ],

        // 월간 매출 데이터
        revenueData: {
            monthly: {
                labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                actual: [1800, 2100, 2450, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                target: [2000, 2200, 2500, 2700, 2800, 3000, 3200, 3100, 3300, 3500, 3400, 3800],
                forecast: [1800, 2100, 2450, 2600, 2750, 2900, 3100, 3000, 3150, 3350, 3250, 3600]
            },
            weekly: {
                labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
                actual: [420, 510, 480, 530, 490, 560, 580, 620, 590, 640, 610, 680],
                target: [500, 500, 500, 550, 550, 550, 600, 600, 600, 650, 650, 650]
            }
        },

        // 팀 성과
        teamPerformance: {
            labels: ['김영업팀', '이전략팀', '박성과팀', '최관리팀', '정협력팀', '강글로벌팀'],
            target: [800, 700, 500, 400, 600, 300],
            achieved: [720, 580, 420, 380, 350, 120]
        },

        // 분기별 목표
        quarterlyGoals: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            target: [2500, 3000, 3200, 3800],
            achieved: [2450, 0, 0, 0]
        }
    },

    /**
     * 데이터 로드
     */
    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('DataStore: Failed to load, using defaults');
        }
        return JSON.parse(JSON.stringify(this.defaultData));
    },

    /**
     * 데이터 저장
     */
    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('DataStore: Failed to save');
        }
    },

    /**
     * 데이터 초기화
     */
    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
        return JSON.parse(JSON.stringify(this.defaultData));
    },

    /**
     * 통계 계산
     */
    getStats(data) {
        const plans = data.salesPlans;
        const deals = data.deals;
        const campaigns = data.campaigns;

        return {
            totalPlans: plans.length,
            activePlans: plans.filter(p => p.status === 'active').length,
            completedPlans: plans.filter(p => p.status === 'completed').length,
            pendingPlans: plans.filter(p => p.status === 'pending').length,
            totalPipelineValue: deals.reduce((s, d) => s + d.amount, 0),
            weightedPipeline: deals.reduce((s, d) => s + d.amount * (d.probability / 100), 0),
            activeCampaigns: campaigns.filter(c => c.status === 'active').length,
            totalBudget: campaigns.reduce((s, c) => s + c.budget, 0),
            totalSpent: campaigns.reduce((s, c) => s + c.spent, 0),
            avgROI: Math.round(campaigns.filter(c => c.roi > 0).reduce((s, c) => s + c.roi, 0) / campaigns.filter(c => c.roi > 0).length)
        };
    }
};
