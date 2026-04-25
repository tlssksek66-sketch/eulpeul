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
        },

        // ===== 샥즈 코리아 매거진 클리핑 =====
        articles: [
            {
                id: 1, featured: 'hero', category: 'product',
                title: '샥즈, 차세대 골전도 \'OpenRun Pro 2\' 한국 공식 출시... 9세대 듀얼 픽업 탑재',
                excerpt: '샥즈 코리아가 골전도 진동 9세대 코어와 듀얼 픽업 트랜스듀서를 탑재한 신형 OpenRun Pro 2를 17일 한국 시장에 정식 출시한다고 밝혔다. 저음 보강과 누음 감소 폭이 전작 대비 40% 개선됐다.',
                source: '지디넷코리아', sourceColor: '#0066ff',
                date: '2026-04-24', daysAgo: 1, views: 12480, sentiment: 'positive',
                tags: ['신제품', 'OpenRun Pro 2', '골전도'], type: 'news', author: '김기자',
                url: 'https://zdnet.co.kr'
            },
            {
                id: 2, featured: 'sub', category: 'sports',
                title: '손흥민과 함께하는 \'오픈러닝 시즌2\' 캠페인 본격 시동',
                excerpt: '샥즈 코리아가 글로벌 앰배서더 손흥민 선수와 함께 한강 일대에서 진행하는 오픈러닝 캠페인 시즌2를 5월 1일부터 시작한다.',
                source: '매일경제', sourceColor: '#cc0000',
                date: '2026-04-23', daysAgo: 2, views: 9821, sentiment: 'positive',
                tags: ['손흥민', '오픈러닝', '캠페인'], type: 'news', author: '박기자',
                url: 'https://mk.co.kr'
            },
            {
                id: 3, featured: 'sub', category: 'review',
                title: 'GQ가 뽑은 2026 러닝 기어 베스트 5에 OpenRun Pro 선정',
                excerpt: '런웨이를 달리는 자에게 어떤 사운드가 어울리는가. GQ 코리아 4월호가 꼽은 러닝 기어 5선에 샥즈 OpenRun Pro가 1위로 이름을 올렸다.',
                source: 'GQ 코리아', sourceColor: '#000000',
                date: '2026-04-22', daysAgo: 3, views: 7340, sentiment: 'positive',
                tags: ['리뷰', '러닝', '베스트5'], type: 'review', author: 'GQ 에디터',
                url: 'https://gqkorea.co.kr'
            },
            {
                id: 4, featured: 'sub', category: 'marketing',
                title: '샥즈 코리아, 2026 서울 마라톤 공식 사운드 파트너 선정',
                excerpt: '서울특별시체육회와 협약을 맺고 11월 개최되는 서울 마라톤의 공식 사운드 파트너로 활동한다. 참가자 전원에게 OpenMove 체험 기회 제공.',
                source: '스포츠경향', sourceColor: '#ff6600',
                date: '2026-04-21', daysAgo: 4, views: 5210, sentiment: 'positive',
                tags: ['서울마라톤', '후원', '파트너십'], type: 'news', author: '이기자',
                url: 'https://sports.khan.co.kr'
            },
            {
                id: 5, category: 'tech',
                title: '골전도 이어폰, 청력 보호 효과 학계 조명... 이비인후과 학회 발표',
                excerpt: '대한이비인후과학회 춘계학술대회에서 골전도 방식이 장시간 음악 청취 시 와우 손상을 줄일 수 있다는 연구 결과가 발표됐다. 샥즈 제품군이 임상 비교 대상에 포함됐다.',
                source: '헬스조선', sourceColor: '#28a745',
                date: '2026-04-20', daysAgo: 5, views: 4180, sentiment: 'positive',
                tags: ['청력보호', '학회', '연구'], type: 'news', author: '한기자',
                url: 'https://health.chosun.com'
            },
            {
                id: 6, category: 'product',
                title: '\'OpenFit Air\' 출시 6개월, 가벼운 오픈형 이어폰 카테고리 1위',
                excerpt: '8.7g의 무게와 IP54 방수 등급을 갖춘 OpenFit Air가 국내 오픈형 무선 이어폰 시장 점유율 1위에 올랐다는 GfK 자료가 공개됐다.',
                source: 'IT조선', sourceColor: '#e60012',
                date: '2026-04-19', daysAgo: 6, views: 6380, sentiment: 'positive',
                tags: ['OpenFit Air', '시장점유율', '1위'], type: 'news', author: '최기자',
                url: 'https://it.chosun.com'
            },
            {
                id: 7, category: 'sports',
                title: '샥즈 OpenSwim Pro, 오픈워터 수영 마니아 사이 입소문 확산',
                excerpt: '한강·동해·제주 오픈워터 수영 동호회를 중심으로 샥즈 OpenSwim Pro의 인기가 빠르게 퍼지고 있다. 32GB 내장 메모리와 8시간 배터리가 핵심.',
                source: '디지털데일리', sourceColor: '#1e88e5',
                date: '2026-04-18', daysAgo: 7, views: 3120, sentiment: 'positive',
                tags: ['OpenSwim Pro', '수영', '오픈워터'], type: 'news', author: '강기자',
                url: 'https://ddaily.co.kr'
            },
            {
                id: 8, category: 'community',
                title: '김연아 인스타에 등장한 샥즈... \'운동 루틴\' 게시물 24시간 만에 12만 좋아요',
                excerpt: '피겨 선수 김연아가 자신의 인스타그램에 샥즈 OpenRun을 착용한 사이클 사진을 올리며 화제가 됐다. 별도 광고가 아닌 자연 노출로 알려졌다.',
                source: '스포츠동아', sourceColor: '#d32f2f',
                date: '2026-04-18', daysAgo: 7, views: 18920, sentiment: 'positive',
                tags: ['김연아', 'SNS', '바이럴'], type: 'community', author: '온라인뉴스팀',
                url: 'https://sports.donga.com'
            },
            {
                id: 9, category: 'marketing',
                title: '샥즈 코리아, 청담동에 첫 플래그십 스토어 그랜드 오픈',
                excerpt: '브랜드 체험 공간을 강화하기 위해 청담동에 230㎡ 규모의 플래그십 스토어를 열었다. 골전도 데모룸과 러닝 트랙이 마련됐다.',
                source: '패션비즈', sourceColor: '#9c27b0',
                date: '2026-04-17', daysAgo: 8, views: 2890, sentiment: 'positive',
                tags: ['플래그십', '청담', '오프라인'], type: 'news', author: '오기자',
                url: 'https://fashionbiz.co.kr'
            },
            {
                id: 10, category: 'marketing',
                title: '블랙프라이데이 최대 35% 할인... 샥즈 공식몰 4월 26일 시작',
                excerpt: '봄맞이 블랙프라이데이 행사를 오는 26일부터 5월 5일까지 진행한다. OpenRun Pro 2를 제외한 전 제품 대상 최대 35% 할인.',
                source: '이데일리', sourceColor: '#ff5722',
                date: '2026-04-17', daysAgo: 8, views: 5430, sentiment: 'neutral',
                tags: ['프로모션', '할인', '공식몰'], type: 'press', author: '편집부',
                url: 'https://edaily.co.kr'
            },
            {
                id: 11, category: 'press',
                title: '샥즈, 시각장애 마라토너 후원 프로그램 \'런 위드 라이트\' 확장',
                excerpt: '시각장애 러너 100명에게 골전도 이어폰을 무상 지원하는 사회공헌 프로그램을 전국으로 확대한다고 발표했다.',
                source: '한겨레', sourceColor: '#005bac',
                date: '2026-04-16', daysAgo: 9, views: 3760, sentiment: 'positive',
                tags: ['CSR', '사회공헌', '시각장애'], type: 'press', author: '사회부',
                url: 'https://hani.co.kr'
            },
            {
                id: 12, category: 'tech',
                title: 'AI 노이즈 캔슬링 적용 샥즈 차기 모델, 특허 출원 확인',
                excerpt: '특허정보검색서비스 키프리스에 \'골전도 진동자 기반 AI 노이즈 캔슬링\' 관련 특허 3건이 샥즈 명의로 등록된 것으로 확인됐다.',
                source: '전자신문', sourceColor: '#1976d2',
                date: '2026-04-15', daysAgo: 10, views: 8120, sentiment: 'positive',
                tags: ['특허', 'AI', '노이즈캔슬링'], type: 'news', author: '서기자',
                url: 'https://etnews.com'
            },
            {
                id: 13, category: 'product',
                title: '골프존카운티와 협업, 골프 특화 골전도 모델 \'OpenGolf\' 공개',
                excerpt: '골프 라운딩에 최적화한 풍절음 저감 알고리즘과 거리계 음성 안내 연동을 지원하는 한정판 모델이 공개됐다.',
                source: '동아일보', sourceColor: '#003478',
                date: '2026-04-14', daysAgo: 11, views: 4290, sentiment: 'positive',
                tags: ['골프', '협업', 'OpenGolf'], type: 'news', author: '김기자',
                url: 'https://donga.com'
            },
            {
                id: 14, category: 'review',
                title: '사이클링 안전 이어폰, 샥즈는 어떻게 다른가 - 1개월 실사용기',
                excerpt: '주행 중에도 차량·자전거 벨 소리를 그대로 들을 수 있는 오픈형 골전도의 장점과 한계를 1개월간 도심·아라뱃길 라이딩으로 검증했다.',
                source: '바이크조선', sourceColor: '#388e3c',
                date: '2026-04-13', daysAgo: 12, views: 5870, sentiment: 'positive',
                tags: ['사이클링', '안전', '실사용'], type: 'review', author: '리뷰팀',
                url: 'https://bike.chosun.com'
            },
            {
                id: 15, category: 'review',
                title: '트레이너 100인이 꼽은 운동용 이어폰 1위... 샥즈 OpenRun',
                excerpt: '여성 종합 매거진이 PT 트레이너 100명을 대상으로 진행한 설문에서 샥즈 OpenRun이 \'가장 많이 추천하는 운동용 이어폰\' 1위에 올랐다.',
                source: '우먼센스', sourceColor: '#e91e63',
                date: '2026-04-12', daysAgo: 13, views: 3210, sentiment: 'positive',
                tags: ['설문', '트레이너', '추천'], type: 'review', author: '에디터',
                url: 'https://womansense.co.kr'
            },
            {
                id: 16, category: 'review',
                title: '[리뷰] 샥즈 OpenMove - 입문자용 가성비 골전도의 완성',
                excerpt: '8만원대로 골전도를 처음 경험하기에 좋은 모델. 음질은 한 단계 위 모델 대비 살짝 부족하지만 일상 사용엔 충분하다.',
                source: '더기어', sourceColor: '#212121',
                date: '2026-04-11', daysAgo: 14, views: 4760, sentiment: 'neutral',
                tags: ['OpenMove', '가성비', '입문'], type: 'review', author: '리뷰어',
                url: 'https://thegear.net'
            },
            {
                id: 17, category: 'press',
                title: 'CES 2026, 샥즈 부스 라이브 데모 현장... \'골전도 + 공간음향\' 시연',
                excerpt: '라스베이거스 CES 현장 부스에서 골전도와 공간음향을 결합한 프로토타입 데모가 공개됐다. 한국 출시 일정도 함께 안내됐다.',
                source: '조선비즈', sourceColor: '#0033a0',
                date: '2026-04-10', daysAgo: 15, views: 6920, sentiment: 'positive',
                tags: ['CES', '공간음향', '데모'], type: 'press', author: '이기자',
                url: 'https://biz.chosun.com'
            },
            {
                id: 18, category: 'community',
                title: '\'샥즈 매일 착용 후기\' - 헤어 인플루언서 게시물 화제',
                excerpt: '구독자 80만 헤어 인플루언서가 헤어스타일에 영향을 주지 않는 골전도 착용감을 호평. 댓글 1,200건 달성.',
                source: '인스타그램', sourceColor: '#e4405f',
                date: '2026-04-09', daysAgo: 16, views: 11280, sentiment: 'positive',
                tags: ['인플루언서', '헤어', 'SNS'], type: 'community', author: '@hairlife_kr',
                url: 'https://instagram.com'
            },
            {
                id: 19, category: 'community',
                title: '사이클 동호회 단체구매 후기 - "10명 중 9명 만족"',
                excerpt: '회원 35명 규모 동호회에서 OpenRun Pro 단체구매 진행 후 만족도 설문 결과 공유. 풍절음과 통화품질이 핵심 칭찬 포인트.',
                source: '네이버 카페', sourceColor: '#03c75a',
                date: '2026-04-08', daysAgo: 17, views: 1820, sentiment: 'positive',
                tags: ['동호회', '단체구매', '커뮤니티'], type: 'community', author: '카페지기',
                url: 'https://cafe.naver.com'
            },
            {
                id: 20, category: 'marketing',
                title: '러너스월드 인터뷰 - 샥즈 코리아 마케팅 디렉터 \'2026 전략\'',
                excerpt: '러너스월드 코리아 5월호 커버스토리에 샥즈 코리아 마케팅 디렉터의 단독 인터뷰가 실렸다. 러닝 콘텐츠 IP 확장이 핵심 키워드.',
                source: '러너스월드', sourceColor: '#ff5252',
                date: '2026-04-07', daysAgo: 18, views: 2940, sentiment: 'positive',
                tags: ['인터뷰', '마케팅', '전략'], type: 'press', author: '편집장',
                url: 'https://runnersworld.co.kr'
            },
            {
                id: 21, category: 'tech',
                title: '샥즈 펌웨어 1.4.2 배포 - LE Audio·LC3 코덱 정식 지원',
                excerpt: '블루투스 LE Audio와 LC3 코덱이 OpenRun Pro 2 / OpenFit 시리즈에 정식 지원되는 펌웨어가 배포됐다.',
                source: '디지털데일리', sourceColor: '#1e88e5',
                date: '2026-04-06', daysAgo: 19, views: 5410, sentiment: 'positive',
                tags: ['펌웨어', 'LE Audio', 'LC3'], type: 'news', author: '강기자',
                url: 'https://ddaily.co.kr'
            },
            {
                id: 22, category: 'sports',
                title: '제주 울트라 마라톤 100K, 참가자 70%가 샥즈 착용',
                excerpt: '제주에서 열린 울트라 마라톤 100K 대회 현장 조사 결과 참가자 70%가 골전도 이어폰을 착용했고 그중 80%가 샥즈였다.',
                source: '스포츠경향', sourceColor: '#ff6600',
                date: '2026-04-05', daysAgo: 20, views: 3680, sentiment: 'positive',
                tags: ['울트라마라톤', '제주', '점유율'], type: 'news', author: '이기자',
                url: 'https://sports.khan.co.kr'
            }
        ],

        // 네이버 검색 API 설정
        naverConfig: {
            clientId: '',
            clientSecret: '',
            query: '샥즈 코리아',
            display: 20,
            proxyUrl: '',
            lastFetched: null
        }
    },

    /**
     * 데이터 로드 (기존 저장 데이터에 신규 기본 키 자동 병합)
     */
    load() {
        const defaults = JSON.parse(JSON.stringify(this.defaultData));
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // 신규 키 누락 시 기본값으로 보강
                Object.keys(defaults).forEach(k => {
                    if (parsed[k] === undefined) parsed[k] = defaults[k];
                });
                return parsed;
            }
        } catch (e) {
            console.warn('DataStore: Failed to load, using defaults');
        }
        return defaults;
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
