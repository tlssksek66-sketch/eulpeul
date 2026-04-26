/**
 * SHOKZ Korea Clipping Magazine - Data Store
 * 40건의 클리핑 mock 데이터 + 채널/카테고리 메타 + 통계 헬퍼
 */
const MagazineData = {
    meta: {
        brand: 'SHOKZ',
        region: 'KOREA',
        searchKeyword: '샥즈 코리아',
        collectedAt: '2026-04-27T00:09:11+09:00',
        totalClippings: 40,
        filterPassed: 40,
        noiseFiltered: 20,
        accuracyFilter: true
    },

    channels: [
        { key: 'news',        label: '뉴스',   color: '#4a7cff', collected: 5,  quota: 20 },
        { key: 'blog',        label: '블로그', color: '#34d399', collected: 15, quota: 20 },
        { key: 'cafearticle', label: '카페',   color: '#fb923c', collected: 20, quota: 20 }
    ],

    categories: [
        { key: 'all',       label: '전체' },
        { key: 'product',   label: '신제품' },
        { key: 'review',    label: '리뷰' },
        { key: 'tech',      label: '기술' },
        { key: 'sports',    label: '스포츠' },
        { key: 'marketing', label: '마케팅' },
        { key: 'press',     label: '보도' },
        { key: 'community', label: '커뮤니티' }
    ],

    categoryColors: {
        product:   '#4a7cff',
        review:    '#34d399',
        tech:      '#22d3ee',
        sports:    '#fbbf24',
        marketing: '#a78bfa',
        press:     '#f87171',
        community: '#fb923c'
    },

    sentimentColors: {
        positive: '#34d399',
        neutral:  '#6b7280',
        negative: '#f87171'
    },

    clippings: [
        // === 뉴스 5건 ===
        { id: 1, channel: 'news', media: '디지털타임스', category: 'press', sentiment: 'neutral',
          title: '샥즈 코리아, 1분기 매출 전년 대비 38% 성장…골전도 시장 1위 굳혀',
          summary: '샥즈 코리아가 2026년 1분기 국내 매출 약 124억원을 기록하며 전년 동기 대비 38% 증가했다고 밝혔다. 러닝·아웃도어 수요가 견인했다는 분석이다.',
          date: '2026-04-26 17:42', url: 'https://www.example.com/dt/2026/04/26/shokz-q1',
          tags: ['샥즈', '골전도', '실적', '매출', '코리아'] },

        { id: 2, channel: 'news', media: '전자신문', category: 'product', sentiment: 'positive',
          title: '샥즈, 신형 \'OpenRun Pro 3\' 한국 정식 출시…노이즈 캔슬링 마이크 탑재',
          summary: '골전도 헤드폰 강자 샥즈가 신모델 OpenRun Pro 3를 4월 27일부터 국내 판매한다. 6개의 마이크 어레이로 통화 품질을 대폭 개선했다.',
          date: '2026-04-27 09:00', url: 'https://www.example.com/etn/openrun-pro-3-launch',
          tags: ['샥즈', 'OpenRun', '신제품', '골전도', '헤드폰'] },

        { id: 3, channel: 'news', media: '헤럴드경제', category: 'product', sentiment: 'neutral',
          title: '샥즈 코리아, 수영 전용 \'OpenSwim Pro\' 색상 2종 추가',
          summary: '샥즈 코리아가 방수 골전도 MP3 OpenSwim Pro에 코랄 핑크·딥 블루 컬러 2종을 추가했다. 가격은 기존 모델과 동일.',
          date: '2026-04-25 14:10', url: 'https://www.example.com/heraldcorp/openswim-color',
          tags: ['샥즈', 'OpenSwim', '신제품', '수영', '골전도'] },

        { id: 4, channel: 'news', media: 'IT동아', category: 'review', sentiment: 'positive',
          title: '[리뷰] OpenRun Pro 2와 비교한 OpenRun Pro 3, 실제로 얼마나 좋아졌나',
          summary: '편집부가 일주일간 신형 OpenRun Pro 3를 사용해본 결과 통화 품질·저음 응답·착용감 모두 개선됐다. 가격 인상은 아쉬운 부분.',
          date: '2026-04-26 11:20', url: 'https://www.example.com/itdonga/review-openrun-pro-3',
          tags: ['샥즈', 'OpenRun', '리뷰', '골전도', '헤드폰'] },

        { id: 5, channel: 'news', media: '스포츠조선', category: 'sports', sentiment: 'positive',
          title: '샥즈, 2026 서울국제마라톤 공식 헤드폰 파트너 선정',
          summary: '샥즈 코리아가 5월 개최되는 서울국제마라톤의 공식 헤드폰 파트너로 선정됐다. 참가자 전원에게 OpenRun 미니 색상 한정판이 증정된다.',
          date: '2026-04-27 08:30', url: 'https://www.example.com/sportschosun/shokz-marathon',
          tags: ['샥즈', '마라톤', '스포츠', '러닝', 'OpenRun'] },

        // === 블로그 1-5 (모두 리뷰) ===
        { id: 6, channel: 'blog', media: '네이버 블로그 · 희망의 블로그', category: 'review', sentiment: 'positive',
          title: '러닝 5년차가 솔직히 써본 샥즈 OpenRun Pro 3 한 달 후기',
          summary: '한강 러닝 코스에서 30km 이상 사용해본 결과, 땀 방수와 착용 안정성에 매우 만족. 다만 외부 소음이 큰 도심 구간에서는 음량을 더 키워야 한다.',
          date: '2026-04-27 06:15', url: 'https://blog.naver.com/hope-blog/openrun-pro-3-1month',
          tags: ['샥즈', '골전도', '러닝', '리뷰', '블로그'] },

        { id: 7, channel: 'blog', media: '네이버 블로그 · 희망의 블로그', category: 'review', sentiment: 'neutral',
          title: '샥즈 OpenSwim Pro vs 일반 방수 이어폰 — 수영장에서 진짜 쓸만할까?',
          summary: '실제 자유형 1.5km 수영 중 사용해본 비교 후기. 골전도 특성상 물속에서도 음악이 들리는 점이 크지만, 음질은 일반 이어폰 대비 한계가 있다.',
          date: '2026-04-26 22:40', url: 'https://blog.naver.com/hope-blog/openswim-vs-regular',
          tags: ['샥즈', 'OpenSwim', '수영', '골전도', '블로그'] },

        { id: 8, channel: 'blog', media: '네이버 블로그 · kaptain_oa', category: 'review', sentiment: 'positive',
          title: '회사원의 출퇴근용 골전도 헤드폰 — 샥즈 OpenRun 미니 솔직 후기',
          summary: '지하철·버스 환승이 많은 출퇴근 환경에서 외부 소리가 들리는 점이 안전상 큰 장점. 다만 고음역대 표현력은 아쉬움.',
          date: '2026-04-27 07:05', url: 'https://blog.naver.com/kaptain-oa/openrun-mini',
          tags: ['샥즈', 'OpenRun', '출퇴근', '골전도', '블로그'] },

        { id: 9, channel: 'blog', media: '네이버 블로그 · runningman', category: 'review', sentiment: 'positive',
          title: '풀코스 마라톤 페이서가 추천하는 골전도 헤드폰 BEST 1',
          summary: '마라톤 페이서 활동 3년차가 다양한 골전도 제품을 직접 비교. 샥즈 OpenRun Pro 3가 장시간 착용·발한 환경에서 가장 우수했다.',
          date: '2026-04-26 20:11', url: 'https://blog.naver.com/runningman/best-bone-conduction',
          tags: ['샥즈', 'OpenRun', '마라톤', '골전도', '러닝', '블로그'] },

        { id: 10, channel: 'blog', media: '네이버 블로그 · 사이클러', category: 'review', sentiment: 'positive',
          title: '자전거 라이딩에 안전한 헤드폰 찾는다면 — 샥즈 OpenRun Pro 3',
          summary: '자전거 동호회 라이딩 중 차량 소리·신호음을 들으면서도 음악 감상이 가능. 헬멧과 간섭 없는 디자인이 특히 좋다.',
          date: '2026-04-26 18:45', url: 'https://blog.naver.com/cyclerlee/shokz-bike',
          tags: ['샥즈', 'OpenRun', '자전거', '안전', '골전도', '블로그'] },

        // === 블로그 6-15 (모두 리뷰) ===
        { id: 11, channel: 'blog', media: '네이버 블로그 · 트라이애슬론', category: 'review', sentiment: 'positive',
          title: '트라이애슬론 선수의 종목별 헤드폰 추천 — 샥즈 OpenSwim Pro & OpenRun',
          summary: '수영·자전거·러닝 전 종목에서 사용해본 결과, 골전도 제품군이 안전성과 편의성 모두 우수. 종목별 추천 모델 정리.',
          date: '2026-04-26 15:30', url: 'https://blog.naver.com/triathlonkr/shokz-recommend',
          tags: ['샥즈', '트라이애슬론', '수영', '러닝', '골전도', '블로그'] },

        { id: 12, channel: 'blog', media: '네이버 블로그 · 김프로의 IT', category: 'review', sentiment: 'neutral',
          title: '샥즈 OpenRun Pro 3 분해 리뷰 — 무게 중심과 마이크 구조 분석',
          summary: '신제품을 분해하여 마이크 어레이 배치와 배터리 위치를 확인. 통화 품질 향상의 비결이 6개 마이크에 있음을 확인했다.',
          date: '2026-04-26 23:10', url: 'https://blog.naver.com/kim-pro-it/teardown',
          tags: ['샥즈', 'OpenRun', '분해', '기술', '골전도', '블로그'] },

        { id: 13, channel: 'blog', media: '네이버 블로그 · 음악감상실', category: 'review', sentiment: 'neutral',
          title: '오디오파일이 본 골전도 헤드폰의 한계와 매력 — 샥즈 사용기',
          summary: '하이파이 환경에 익숙한 사용자 입장에서 골전도 제품의 음질은 한계가 있지만, 운동·이동 시의 편의성은 대체 불가하다.',
          date: '2026-04-25 21:00', url: 'https://blog.naver.com/audio-room/bone-conduction-pros',
          tags: ['샥즈', '골전도', '오디오', '음질', '블로그'] },

        { id: 14, channel: 'blog', media: '네이버 블로그 · 헬스장일기', category: 'review', sentiment: 'positive',
          title: '헬스장 운동에 잘 어울리는 헤드폰 — 샥즈 OpenRun 일주일 사용기',
          summary: '웨이트 트레이닝·러닝머신·요가 모두 무리 없이 사용 가능. 트레이너의 큐를 들으면서도 음악 재생이 가능해 좋다.',
          date: '2026-04-25 19:25', url: 'https://blog.naver.com/gym-diary/shokz-week',
          tags: ['샥즈', 'OpenRun', '운동', '헬스', '골전도', '블로그'] },

        { id: 15, channel: 'blog', media: '네이버 블로그 · 출퇴근라이프', category: 'review', sentiment: 'neutral',
          title: '직장인의 출퇴근 헤드폰 픽 — 샥즈 OpenRun 미니 vs 노이즈캔슬링',
          summary: '환경별로 어울리는 헤드폰이 다르다는 결론. 안전이 중요한 도보 이동 구간에서는 골전도, 사무실에서는 노이즈캔슬링 추천.',
          date: '2026-04-25 18:00', url: 'https://blog.naver.com/commute-life/shokz-vs-anc',
          tags: ['샥즈', 'OpenRun', '출퇴근', '비교', '골전도', '블로그'] },

        { id: 16, channel: 'blog', media: '네이버 블로그 · 오디오마니아', category: 'review', sentiment: 'negative',
          title: '솔직히 실망한 OpenRun Pro 3 — 가격 인상 대비 체감 차이가 미미',
          summary: '전작 대비 마이크 외에 음질·착용감 변화는 크지 않다. 25% 가격 인상은 과도하다는 인상.',
          date: '2026-04-26 14:55', url: 'https://blog.naver.com/audio-mania/disappointed',
          tags: ['샥즈', 'OpenRun', '리뷰', '단점', '블로그'] },

        { id: 17, channel: 'blog', media: '네이버 블로그 · 골프초보', category: 'review', sentiment: 'neutral',
          title: '필드에서 캐디 안내 들으면서 음악도 듣고 — 샥즈 OpenRun 골프 후기',
          summary: '라운딩 중 캐디 안내·동반자와 대화를 들으면서도 좋아하는 음악 청취 가능. 의외의 골프용 명템.',
          date: '2026-04-25 16:40', url: 'https://blog.naver.com/golf-beginner/shokz-golf',
          tags: ['샥즈', 'OpenRun', '골프', '운동', '골전도', '블로그'] },

        { id: 18, channel: 'blog', media: '네이버 블로그 · 등산좋아', category: 'review', sentiment: 'neutral',
          title: '주말 등산용 헤드폰으로 샥즈 — 산속에서 진짜 쓸만한가',
          summary: '산행 중 자연 소리를 들으면서 음악도 듣는 점은 좋으나, 거센 바람 부는 능선에서는 음량이 다소 부족하다.',
          date: '2026-04-25 09:30', url: 'https://blog.naver.com/hiking-fan/shokz-mountain',
          tags: ['샥즈', 'OpenRun', '등산', '아웃도어', '골전도', '블로그'] },

        { id: 19, channel: 'blog', media: '네이버 블로그 · 한강러너', category: 'review', sentiment: 'positive',
          title: '한강 야간 러닝에 골전도가 답이다 — 샥즈 OpenRun 추천',
          summary: '야간 한강 코스에서 자전거·다른 러너의 접근음을 들을 수 있어 안전. 가시성이 떨어지는 시간대일수록 골전도가 빛난다.',
          date: '2026-04-24 22:15', url: 'https://blog.naver.com/hangang-runner/night-running',
          tags: ['샥즈', 'OpenRun', '러닝', '한강', '안전', '블로그'] },

        { id: 20, channel: 'blog', media: '네이버 블로그 · 스마트워치체험', category: 'review', sentiment: 'neutral',
          title: '갤럭시워치+샥즈 OpenRun 조합 — 스마트워치 러너의 최강 세팅',
          summary: '갤럭시워치 GPS·심박 측정과 샥즈 골전도 헤드폰의 음악 재생 조합이 야외 러닝에 최적. 페어링 안정성도 우수.',
          date: '2026-04-24 17:45', url: 'https://blog.naver.com/smartwatch-trial/galaxy-shokz',
          tags: ['샥즈', 'OpenRun', '스마트워치', '러닝', '골전도', '블로그'] },

        // === 카페 1-10 (모두 커뮤니티) ===
        { id: 21, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
          title: '샥즈 OpenRun Pro 3 사신 분 계실까요? 후기 부탁드립니다',
          summary: '워킹과 가벼운 조깅 위주로 사용할 예정인데 신모델 가치가 있을지 고민됩니다. 사용해보신 분들 의견 부탁드려요.',
          date: '2026-04-27 08:55', url: 'https://cafe.naver.com/walkingclub/12001',
          tags: ['샥즈', 'OpenRun', '카페', '커뮤니티', '문의'] },

        { id: 22, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
            title: '아침 워킹용 골전도 헤드폰 어떤 모델이 좋을까요',
          summary: '매일 아침 5km 워킹 코스에서 사용할 헤드폰을 찾고 있습니다. 샥즈 OpenRun과 OpenRun 미니 중 추천 부탁드려요.',
          date: '2026-04-27 06:40', url: 'https://cafe.naver.com/walkingclub/12005',
          tags: ['샥즈', 'OpenRun', '카페', '커뮤니티', '워킹'] },

        { id: 23, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
          title: '샥즈 헤드폰 배터리 오래 쓰는 분 계신가요',
          summary: '2년 정도 사용하니 배터리가 눈에 띄게 줄어드는 느낌인데, 다른 분들은 어떠신지 궁금합니다.',
          date: '2026-04-26 21:30', url: 'https://cafe.naver.com/walkingclub/11988',
          tags: ['샥즈', '배터리', '카페', '커뮤니티'] },

        { id: 24, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
          title: '워킹 모임에서 골전도 헤드폰 인기인 이유',
          summary: '동호회 모임에서 보면 절반 이상이 샥즈를 사용하시던데, 안전상 이유가 가장 큰 것 같습니다.',
          date: '2026-04-26 17:15', url: 'https://cafe.naver.com/walkingclub/11975',
          tags: ['샥즈', '워킹', '카페', '커뮤니티', '안전'] },

        { id: 25, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
          title: '샥즈 OpenRun 미니 사이즈 사이에서 고민 중입니다',
          summary: '여성용 작은 머리에는 미니가 맞을 것 같은데, 일반 사이즈를 쓰시는 분들 후기도 듣고 싶습니다.',
          date: '2026-04-25 22:20', url: 'https://cafe.naver.com/walkingclub/11960',
          tags: ['샥즈', 'OpenRun', '미니', '카페', '커뮤니티'] },

        { id: 26, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
          title: '겨울철 골전도 헤드폰 — 모자 위에 써도 괜찮을까요',
          summary: '비니나 모자 위에 샥즈를 쓰셔도 음질이 괜찮은지 궁금합니다. 추운 새벽 워킹 시 꼭 필요한 정보인데요.',
          date: '2026-04-25 08:45', url: 'https://cafe.naver.com/walkingclub/11940',
          tags: ['샥즈', '골전도', '겨울', '카페', '커뮤니티'] },

        { id: 27, channel: 'cafearticle', media: '네이버 카페 · 워킹클럽', category: 'community', sentiment: 'neutral',
          title: '샥즈 OpenRun 분실 방지 팁 공유',
          summary: '운동 중 헤드폰 분실 위험이 있어서, 케이블에 ID 태그를 부착하는 방법을 공유드립니다.',
          date: '2026-04-24 19:10', url: 'https://cafe.naver.com/walkingclub/11920',
          tags: ['샥즈', 'OpenRun', '팁', '카페', '커뮤니티'] },

        { id: 28, channel: 'cafearticle', media: '네이버 카페 · 77사이즈 언니', category: 'community', sentiment: 'neutral',
          title: '다이어트 워킹용 헤드폰 추천 — 샥즈 어떤가요',
          summary: '다이어트 시작하면서 매일 1시간씩 빠르게 걷고 있는데, 일반 이어폰은 자꾸 빠져서요. 샥즈 골전도가 답일까요?',
          date: '2026-04-26 20:00', url: 'https://cafe.naver.com/77size-sister/8810',
          tags: ['샥즈', '다이어트', '워킹', '카페', '커뮤니티'] },

        { id: 29, channel: 'cafearticle', media: '네이버 카페 · 77사이즈 언니', category: 'community', sentiment: 'neutral',
          title: '샥즈 색상 추천 — 운동복과 매치하기 좋은 컬러',
          summary: '새로 나온 OpenSwim Pro 코랄 핑크 너무 예뻐요! 다른 분들은 어떤 색상 쓰고 계신가요?',
          date: '2026-04-26 14:25', url: 'https://cafe.naver.com/77size-sister/8795',
          tags: ['샥즈', 'OpenSwim', '색상', '카페', '커뮤니티'] },

        { id: 30, channel: 'cafearticle', media: '네이버 카페 · 77사이즈 언니', category: 'community', sentiment: 'neutral',
          title: '여성용 작은 머리에 맞는 골전도 헤드폰',
          summary: '머리가 작은 편이라 일반 헤드폰은 자꾸 흘러내려서 고민이었는데, 샥즈 OpenRun 미니가 잘 맞더라고요.',
          date: '2026-04-25 12:50', url: 'https://cafe.naver.com/77size-sister/8770',
          tags: ['샥즈', 'OpenRun', '미니', '여성용', '카페', '커뮤니티'] },

        // === 카페 11-20 (모두 커뮤니티) ===
        { id: 31, channel: 'cafearticle', media: '네이버 카페 · 77사이즈 언니', category: 'community', sentiment: 'neutral',
          title: '샥즈 OpenRun 어디서 사는 게 가장 저렴한가요',
          summary: '공식몰, 쿠팡, 네이버 스마트스토어 가격이 다 다르던데 어디가 가장 안전하고 저렴한지 정보 부탁드려요.',
          date: '2026-04-25 09:20', url: 'https://cafe.naver.com/77size-sister/8755',
          tags: ['샥즈', 'OpenRun', '구매', '카페', '커뮤니티'] },

        { id: 32, channel: 'cafearticle', media: '네이버 카페 · 네이버 쇼핑픽', category: 'community', sentiment: 'neutral',
          title: '오늘의 핫딜 — 샥즈 OpenRun Pro 2 마지막 재고 할인',
          summary: '신모델 출시로 OpenRun Pro 2가 30% 할인 진행 중. 운동용으로는 충분히 좋은 모델이라 가성비 좋은 선택.',
          date: '2026-04-27 10:30', url: 'https://cafe.naver.com/shoppingpick/55401',
          tags: ['샥즈', 'OpenRun', '할인', '카페', '커뮤니티'] },

        { id: 33, channel: 'cafearticle', media: '네이버 카페 · 네이버 쇼핑픽', category: 'community', sentiment: 'neutral',
          title: '샥즈 신제품 OpenRun Pro 3 사전예약 혜택 정리',
          summary: '공식몰에서 사전예약 시 전용 케이스와 추가 보증 1년이 제공됩니다. 4월 30일까지.',
          date: '2026-04-26 13:00', url: 'https://cafe.naver.com/shoppingpick/55375',
          tags: ['샥즈', 'OpenRun', '사전예약', '혜택', '카페', '커뮤니티'] },

        { id: 34, channel: 'cafearticle', media: '네이버 카페 · 당신에게 도움을', category: 'community', sentiment: 'neutral',
          title: '청각이 좋지 않으신 부모님께 골전도 헤드폰 선물해드린 후기',
          summary: '70대 부모님께 샥즈 OpenRun을 선물해드렸더니, 일반 이어폰보다 훨씬 편하게 사용하신다고 합니다.',
          date: '2026-04-26 11:15', url: 'https://cafe.naver.com/help-you/3350',
          tags: ['샥즈', 'OpenRun', '선물', '시니어', '카페', '커뮤니티'] },

        { id: 35, channel: 'cafearticle', media: '네이버 카페 · 당신에게 도움을', category: 'community', sentiment: 'neutral',
          title: '보청기 사용자도 쓸 수 있는 샥즈 골전도 헤드폰 정보',
          summary: '보청기를 착용하시는 분들도 사용 가능한 골전도 제품에 대한 문의가 많아서 정리해드립니다.',
          date: '2026-04-25 14:40', url: 'https://cafe.naver.com/help-you/3340',
          tags: ['샥즈', '골전도', '보청', '카페', '커뮤니티'] },

        { id: 36, channel: 'cafearticle', media: '네이버 카페 · 아이템 추천', category: 'community', sentiment: 'neutral',
          title: '4월 운동템 추천 — 샥즈 OpenRun Pro 3 후기 모음',
          summary: '다양한 사용자 후기를 모아보면, 운동용으로 신모델 가치가 충분하다는 평이 많습니다.',
          date: '2026-04-26 19:30', url: 'https://cafe.naver.com/itempick/9920',
          tags: ['샥즈', 'OpenRun', '추천', '운동', '카페', '커뮤니티'] },

        { id: 37, channel: 'cafearticle', media: '네이버 카페 · 아이템 추천', category: 'community', sentiment: 'neutral',
          title: '여름 수영장에 가져갈 헤드폰 — 샥즈 OpenSwim Pro 정보',
          summary: '5월부터 시즌 시작인 만큼, 방수 골전도 MP3가 미리 필요하신 분들께 추천드려요.',
          date: '2026-04-25 17:25', url: 'https://cafe.naver.com/itempick/9905',
          tags: ['샥즈', 'OpenSwim', '수영', '여름', '카페', '커뮤니티'] },

        { id: 38, channel: 'cafearticle', media: '네이버 카페 · 러닝메이트', category: 'community', sentiment: 'neutral',
          title: '러닝 동호회 모임 후기 — 샥즈 협찬 굿즈도 받았어요',
          summary: '주말 러닝 모임에 샥즈 코리아에서 부스를 운영해 다양한 모델을 체험할 수 있었습니다. OpenRun 미니 한정판 굿즈도 증정.',
          date: '2026-04-27 11:45', url: 'https://cafe.naver.com/runmate/4488',
          tags: ['샥즈', 'OpenRun', '러닝', '동호회', '카페', '커뮤니티'] },

        { id: 39, channel: 'cafearticle', media: '네이버 카페 · 마라톤사랑', category: 'community', sentiment: 'neutral',
          title: '서울국제마라톤 참가자분들 — 샥즈 굿즈 받으셨나요',
          summary: '이번 마라톤 공식 헤드폰 파트너가 샥즈라서, 참가팩에 OpenRun 미니 한정판이 들어있다고 합니다.',
          date: '2026-04-27 09:50', url: 'https://cafe.naver.com/marathon-love/22155',
          tags: ['샥즈', 'OpenRun', '마라톤', '굿즈', '카페', '커뮤니티'] },

        { id: 40, channel: 'cafearticle', media: '네이버 카페 · 수영가족', category: 'community', sentiment: 'neutral',
          title: 'OpenSwim Pro 신규 컬러 어떠신가요 — 코랄 핑크 후기',
          summary: '코랄 핑크 컬러 사진으로만 보다가 실물 보니 더 예쁘네요. 수영장에서 잘 보여서 분실 위험도 줄어들 듯.',
          date: '2026-04-26 16:00', url: 'https://cafe.naver.com/swim-family/7720',
          tags: ['샥즈', 'OpenSwim', '수영', '색상', '카페', '커뮤니티'] }
    ],

    /**
     * 카테고리 또는 검색어로 필터링
     */
    filter(category, query) {
        const q = (query || '').trim().toLowerCase();
        return this.clippings.filter(c => {
            const catOk = !category || category === 'all' || c.category === category;
            if (!catOk) return false;
            if (!q) return true;
            return (c.title + ' ' + c.summary + ' ' + c.tags.join(' ')).toLowerCase().includes(q);
        });
    },

    /**
     * 일별 클리핑 추이 (최근 14일)
     */
    getDailyTrend() {
        const dayMap = {};
        this.clippings.forEach(c => {
            const day = c.date.slice(0, 10); // YYYY-MM-DD
            dayMap[day] = (dayMap[day] || 0) + 1;
        });
        const labels = [];
        const counts = [];
        // KST 기준 4/27을 today로 고정 (스크린샷의 수집 시점)
        const todayY = 2026, todayM = 3 /* 0-indexed: April */, todayD = 27;
        for (let i = 13; i >= 0; i--) {
            const d = new Date(todayY, todayM, todayD - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const key = `${yyyy}-${mm}-${dd}`;
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
            counts.push(dayMap[key] || 0);
        }
        return { labels, counts };
    },

    /**
     * 채널별 합계 (도넛용)
     */
    getChannelMix() {
        const counts = {};
        this.clippings.forEach(c => {
            counts[c.channel] = (counts[c.channel] || 0) + 1;
        });
        return this.channels.map(ch => ({
            label: ch.label,
            value: counts[ch.key] || 0,
            color: ch.color
        }));
    },

    /**
     * 카테고리별 합계 (도넛용, 0건은 제외)
     */
    getCategoryMix() {
        const counts = {};
        this.clippings.forEach(c => {
            counts[c.category] = (counts[c.category] || 0) + 1;
        });
        return this.categories
            .filter(cat => cat.key !== 'all' && (counts[cat.key] || 0) > 0)
            .map(cat => ({
                key: cat.key,
                label: cat.key === 'press' ? '보도/IR' : cat.label,
                value: counts[cat.key],
                color: this.categoryColors[cat.key] || '#6b7280'
            }));
    },

    /**
     * 감성 비율
     */
    getSentimentMix() {
        const counts = { positive: 0, neutral: 0, negative: 0 };
        this.clippings.forEach(c => { counts[c.sentiment]++; });
        const total = this.clippings.length;
        return [
            { key: 'positive', label: '긍정', value: counts.positive, color: this.sentimentColors.positive, pct: Math.round(counts.positive / total * 100) },
            { key: 'neutral',  label: '중립', value: counts.neutral,  color: this.sentimentColors.neutral,  pct: Math.round(counts.neutral  / total * 100) },
            { key: 'negative', label: '부정', value: counts.negative, color: this.sentimentColors.negative, pct: Math.round(counts.negative / total * 100) }
        ];
    },

    /**
     * 매체 Top 10
     */
    getMediaTop(limit = 10) {
        const counts = {};
        this.clippings.forEach(c => {
            counts[c.media] = (counts[c.media] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    },

    /**
     * 키워드 Top 10
     */
    getKeywordTop(limit = 10) {
        // 검색어/제품명/카테고리 라벨은 키워드 통계에서 제외 (콘텐츠 토픽 위주로)
        const exclude = new Set(['샥즈', 'OpenRun', 'OpenSwim', '커뮤니티']);
        const counts = {};
        this.clippings.forEach(c => {
            (c.tags || []).forEach(tag => {
                if (exclude.has(tag)) return;
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    },

    /**
     * 매체 수 (distinct media)
     */
    getMediaCount() {
        return new Set(this.clippings.map(c => c.media)).size;
    }
};
