/**
 * AdPlatforms - 네이버 광고 통합 어댑터 & 정규화 계층
 *
 * 본 시스템이 다루는 두 개의 네이버 광고 제품:
 *   1) Naver SA  (검색광고)
 *      - 상품유형: 파워링크, 쇼핑검색
 *      - 구조: 캠페인 → 광고그룹 → 키워드/소재
 *   2) Naver GFA (성과형 디스플레이광고)
 *      - 캠페인 목적: 트래픽, 전환, 쇼핑프로모션, ADVoost 쇼핑, 카탈로그
 *      - 구조: 캠페인 → 광고그룹 → 소재
 *
 * 책임:
 *  1) 두 제품의 서로 다른 구조(SA = 키워드 단위, GFA = 소재/오디언스 단위)를
 *     단일 표준 KPI 스키마({impressions, clicks, cost, conversions, revenue})로 정규화.
 *  2) 통합 관제 화면이 사용하는 집계/파생 지표 API 제공.
 *  3) 실제 운영용 어댑터 시그니처는 adapter 네임스페이스에 스텁으로 둔다.
 *
 * KPI 단위 약속:
 *  - cost, revenue: 원(KRW)
 *  - impressions, clicks, conversions: 정수
 *  - 파생 지표 ctr/cpc/cvr/roas/cpa는 derive() 호출 시 계산
 */
const AdPlatforms = {
    /** 광고 소스 정의 (둘 다 네이버) */
    sources: {
        naver_sa: {
            id: 'naver_sa',
            name: 'Naver SA',
            label: '네이버 검색광고',
            type: 'search',
            color: '#03C75A',
            mark: 'SA',
            products: ['파워링크', '쇼핑검색']
        },
        naver_gfa: {
            id: 'naver_gfa',
            name: 'Naver GFA',
            label: '네이버 성과형 디스플레이광고',
            type: 'performance_display',
            color: '#03C75A',
            mark: 'GFA',
            objectives: ['트래픽', '전환', '쇼핑프로모션', 'ADVoost쇼핑', '카탈로그']
        }
    },

    /**
     * 정규화 KPI 합산
     */
    sumKpis(list) {
        const acc = { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 };
        list.forEach((k) => {
            if (!k) return;
            acc.impressions += k.impressions || 0;
            acc.clicks += k.clicks || 0;
            acc.cost += k.cost || 0;
            acc.conversions += k.conversions || 0;
            acc.revenue += k.revenue || 0;
        });
        return acc;
    },

    /** 파생 지표 계산 */
    derive(kpi) {
        const ctr = kpi.impressions > 0 ? (kpi.clicks / kpi.impressions) * 100 : 0;
        const cpc = kpi.clicks > 0 ? kpi.cost / kpi.clicks : 0;
        const cvr = kpi.clicks > 0 ? (kpi.conversions / kpi.clicks) * 100 : 0;
        const roas = kpi.cost > 0 ? (kpi.revenue / kpi.cost) * 100 : 0;
        const cpa = kpi.conversions > 0 ? kpi.cost / kpi.conversions : 0;
        return Object.assign({}, kpi, { ctr, cpc, cvr, roas, cpa });
    },

    /** 모든 캠페인 (소스 필터 가능) */
    getAllCampaigns(data, sourceId) {
        const list = (data.adPlatforms && data.adPlatforms.campaigns) || [];
        return sourceId ? list.filter((c) => c.source === sourceId) : list;
    },

    /** 소스별 KPI 합계 */
    getKpisBySource(data) {
        return Object.keys(this.sources).map((sid) => {
            const camps = this.getAllCampaigns(data, sid);
            const totals = this.sumKpis(camps.map((c) => c.kpis));
            return {
                source: this.sources[sid],
                campaignCount: camps.length,
                activeCount: camps.filter((c) => c.status === 'active').length,
                kpi: this.derive(totals),
                budgetDaily: camps.reduce((s, c) => s + (c.dailyBudget || 0), 0)
            };
        });
    },

    /** 전체 합계 KPI */
    getKpiTotals(data) {
        const camps = this.getAllCampaigns(data);
        return this.derive(this.sumKpis(camps.map((c) => c.kpis)));
    },

    /**
     * 페이싱(예산 소진율) 추정.
     * 데모: cost / (dailyBudget * 30) 기준.
     * production: 캠페인 시작일~오늘 일수로 분모 계산해야 함.
     */
    pacingPercent(campaign) {
        const denom = (campaign.dailyBudget || 0) * 30;
        if (denom <= 0) return 0;
        return Math.min((campaign.kpis.cost / denom) * 100, 200);
    },

    /** 운영 알림 */
    getAlerts(data) {
        return (data.adPlatforms && data.adPlatforms.alerts) || [];
    },

    /** 키워드 (SA 전용) */
    getKeywords(data) {
        return (data.adPlatforms && data.adPlatforms.keywords) || [];
    },

    /** 소재 (GFA 전용) */
    getCreatives(data) {
        return (data.adPlatforms && data.adPlatforms.creatives) || [];
    },

    /**
     * 실제 운영용 어댑터 시그니처(스텁).
     * production 시 OAuth + 페이지네이션 + 레이트리밋 처리.
     */
    adapter: {
        async fetchSACampaigns(/* customerId, productType, since, until */) {
            // POST https://api.searchad.naver.com/ncc/campaigns 등에 대응
            throw new Error('not_implemented_in_demo');
        },
        async fetchGFACampaigns(/* adAccountId, objective, since, until */) {
            // GFA(성과형 디스플레이광고) Open API에 대응
            throw new Error('not_implemented_in_demo');
        }
    }
};

/**
 * 데모용 mock 데이터 — DataStore.defaultData에 머지된다.
 *
 * SA 캠페인: 파워링크 / 쇼핑검색 상품유형 구분
 * GFA 캠페인: 캠페인 목적 5종(트래픽 / 전환 / 쇼핑프로모션 / ADVoost쇼핑 / 카탈로그)으로 구성
 */
const AdPlatformsMockData = {
    adPlatforms: {
        accounts: [
            { id: 'sa-acct-1', source: 'naver_sa', name: 'eulpeul-naver-sa', currency: 'KRW', status: 'active' },
            { id: 'gfa-acct-1', source: 'naver_gfa', name: 'eulpeul-naver-gfa', currency: 'KRW', status: 'active' }
        ],
        campaigns: [
            // ===== Naver SA · 파워링크 =====
            {
                id: 'sa-c-1', source: 'naver_sa', accountId: 'sa-acct-1',
                product: '파워링크', name: '브랜드 검색 - 핵심 KW', objective: '브랜드보호',
                dailyBudget: 5000000, status: 'active',
                kpis: { impressions: 1240000, clicks: 38400, cost: 31200000, conversions: 2840, revenue: 412000000 }
            },
            {
                id: 'sa-c-2', source: 'naver_sa', accountId: 'sa-acct-1',
                product: '파워링크', name: '키워드 - 신규 유입', objective: '리드',
                dailyBudget: 8000000, status: 'active',
                kpis: { impressions: 2840000, clicks: 64200, cost: 58400000, conversions: 1920, revenue: 287000000 }
            },
            // ===== Naver SA · 쇼핑검색 =====
            {
                id: 'sa-c-3', source: 'naver_sa', accountId: 'sa-acct-1',
                product: '쇼핑검색', name: '쇼핑검색 - 카탈로그 전환', objective: '구매전환',
                dailyBudget: 3500000, status: 'active',
                kpis: { impressions: 980000, clicks: 28200, cost: 24800000, conversions: 1340, revenue: 198000000 }
            },
            // ===== Naver GFA · 캠페인 목적 5종 =====
            {
                id: 'gfa-c-1', source: 'naver_gfa', accountId: 'gfa-acct-1',
                objective: '트래픽', name: 'GFA - 사이트 트래픽 확장',
                dailyBudget: 3000000, status: 'active',
                kpis: { impressions: 4200000, clicks: 28400, cost: 14200000, conversions: 380, revenue: 48000000 }
            },
            {
                id: 'gfa-c-2', source: 'naver_gfa', accountId: 'gfa-acct-1',
                objective: '전환', name: 'GFA - 구매 전환 리타겟',
                dailyBudget: 4000000, status: 'active',
                kpis: { impressions: 3800000, clicks: 22400, cost: 18200000, conversions: 980, revenue: 145000000 }
            },
            {
                id: 'gfa-c-3', source: 'naver_gfa', accountId: 'gfa-acct-1',
                objective: '쇼핑프로모션', name: 'GFA - 시즌 프로모션 노출',
                dailyBudget: 2500000, status: 'active',
                kpis: { impressions: 5800000, clicks: 18400, cost: 12400000, conversions: 540, revenue: 82000000 }
            },
            {
                id: 'gfa-c-4', source: 'naver_gfa', accountId: 'gfa-acct-1',
                objective: 'ADVoost쇼핑', name: 'GFA - ADVoost 자동최적화',
                dailyBudget: 5000000, status: 'active',
                kpis: { impressions: 6800000, clicks: 32400, cost: 22800000, conversions: 1240, revenue: 168000000 }
            },
            {
                id: 'gfa-c-5', source: 'naver_gfa', accountId: 'gfa-acct-1',
                objective: '카탈로그', name: 'GFA - 카탈로그 다이내믹',
                dailyBudget: 3500000, status: 'paused',
                kpis: { impressions: 2400000, clicks: 14200, cost: 9800000, conversions: 320, revenue: 42000000 }
            }
        ],
        // SA · 핵심 키워드 성과
        keywords: [
            { id: 'kw-1', campaignId: 'sa-c-1', text: '샥즈 공식', matchType: '구문', kpi: { impressions: 320000, clicks: 18400, cost: 9200000, conversions: 1480, revenue: 218000000 } },
            { id: 'kw-2', campaignId: 'sa-c-1', text: '오픈이어 이어폰', matchType: '확장', kpi: { impressions: 480000, clicks: 12800, cost: 11200000, conversions: 820, revenue: 124000000 } },
            { id: 'kw-3', campaignId: 'sa-c-2', text: '골전도 이어폰 추천', matchType: '확장', kpi: { impressions: 920000, clicks: 24200, cost: 22400000, conversions: 680, revenue: 98000000 } },
            { id: 'kw-4', campaignId: 'sa-c-2', text: '러닝 이어폰', matchType: '확장', kpi: { impressions: 680000, clicks: 18400, cost: 16800000, conversions: 540, revenue: 78000000 } },
            { id: 'kw-5', campaignId: 'sa-c-3', text: '사평 키마카레', matchType: '구문', kpi: { impressions: 180000, clicks: 8400, cost: 6200000, conversions: 480, revenue: 72000000 } },
            { id: 'kw-6', campaignId: 'sa-c-3', text: '대구 카레 맛집', matchType: '확장', kpi: { impressions: 320000, clicks: 9800, cost: 8400000, conversions: 380, revenue: 56000000 } }
        ],
        // GFA · 소재 성과
        creatives: [
            { id: 'cr-1', campaignId: 'gfa-c-1', name: '[샥즈] 가을 러닝 이미지', format: 'IMAGE', objective: '트래픽', kpi: { impressions: 2400000, clicks: 16400, cost: 8200000, conversions: 220, revenue: 28000000 } },
            { id: 'cr-2', campaignId: 'gfa-c-2', name: '[사평] 마켓컬리 입점 리타겟', format: 'IMAGE', objective: '전환', kpi: { impressions: 1800000, clicks: 12400, cost: 9800000, conversions: 580, revenue: 88000000 } },
            { id: 'cr-3', campaignId: 'gfa-c-3', name: '[샥즈] 시즌 세일 비디오', format: 'VIDEO', objective: '쇼핑프로모션', kpi: { impressions: 3200000, clicks: 11400, cost: 7800000, conversions: 320, revenue: 48000000 } },
            { id: 'cr-4', campaignId: 'gfa-c-4', name: '[샥즈+사평] ADVoost 자동소재', format: 'DYNAMIC', objective: 'ADVoost쇼핑', kpi: { impressions: 6800000, clicks: 32400, cost: 22800000, conversions: 1240, revenue: 168000000 } },
            { id: 'cr-5', campaignId: 'gfa-c-5', name: '[샥즈] 카탈로그 라인업 다이내믹', format: 'DYNAMIC', objective: '카탈로그', kpi: { impressions: 1800000, clicks: 10800, cost: 7200000, conversions: 240, revenue: 32000000 } }
        ],
        // 운영 알림
        alerts: [
            { id: 'al-1', severity: 'warn', source: 'naver_sa', target: 'sa-c-2', text: '키워드 - 신규 유입 캠페인의 일 예산 소진 페이스가 124%로 가속 중입니다.', time: '8분 전' },
            { id: 'al-2', severity: 'critical', source: 'naver_gfa', target: 'gfa-c-5', text: '카탈로그 다이내믹 캠페인이 PAUSED 상태입니다 (24h 이상).', time: '32분 전' },
            { id: 'al-3', severity: 'info', source: 'naver_sa', target: 'sa-c-1', text: '브랜드 검색 핵심 KW의 ROAS가 1320%로 임계치 상회 — 예산 증액 검토 권장.', time: '1시간 전' },
            { id: 'al-4', severity: 'warn', source: 'naver_gfa', target: 'gfa-c-1', text: '트래픽 캠페인의 CPA가 평균 대비 ↑ 38%.', time: '2시간 전' }
        ]
    }
};
