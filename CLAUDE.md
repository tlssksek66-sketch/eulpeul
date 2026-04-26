# Eulpeul · Shokz GFA Engine

이 레포는 두 갈래다.

1. **루트(`index.html` + `assets/`)** — 레거시 영업 기획/IMC 매니지먼트 바닐라 HTML 대시보드. 본 엔진 작업과 직접적 의존이 없으며, 변경 요청이 없다면 건드리지 말 것.
2. **`gfa-engine/`** — Shokz 브랜드를 위한 NAVER GFA 모바일 피드 1200×1200 시안 자동화 엔진 V1 (Vite + React + Tailwind). 진행 중인 작업의 거의 전부가 여기에 있다.

`.github/workflows/ci.yml`은 `gfa-engine` 전용. 루트 변경에는 워크플로우가 없다.

## gfa-engine 디렉터리 맵

```
gfa-engine/
├── public/products/*.svg        axis별 1200×1200 플레이스홀더 자산
├── src/
│   ├── App.jsx                  최상위 화면(상태 오너)
│   ├── main.jsx · index.css     엔트리 + Tailwind 베이스
│   ├── components/
│   │   ├── GfaPreview.jsx       모바일 피드 카드 (지면 시안)
│   │   ├── GfaCreative1200.jsx  실제 송출용 1200×1200 단독 비주얼
│   │   ├── CopyGenerator.jsx    LLM 4축 일괄 생성 패널
│   │   ├── CandidatePicker.jsx  per-variant 후보 N개 비교/선택
│   │   ├── BatchRunner.jsx      큐 JSON 입력 + progress 로그
│   │   └── BatchHost.jsx        배치 작업 전용 오프스크린 렌더 호스트
│   └── engine/                  React 의존 없는 순수 모듈
│       ├── creatives.json       시드 데이터셋 (campaign + defaults + variants)
│       ├── inject.js            injectVariant / injectAll / lintCopy
│       ├── assetResolver.js     axis → /products/*.svg 매핑
│       ├── copyAdapter.js       Ollama 호출 / generateCopy / generateCopyCandidates
│       ├── exportPng.js         html-to-image 래퍼 + buildFilename
│       ├── exportDataset.js     creatives.json 라운드트립
│       ├── batchRunner.js       큐 처리 + JSZip
│       └── __tests__/*.test.js  Vitest unit tests (35개)
├── tailwind.config.js           샥즈 브랜드 토큰 정의처
├── eslint.config.js · .prettierrc.json · vitest.config.js
└── package.json
```

## 주요 명령

전부 `gfa-engine/` 안에서 돌린다.

```bash
npm run dev           # Vite dev server (5173, host:true)
npm run build         # 프로덕션 빌드 → dist/
npm run preview       # 빌드 산출물 로컬 확인
npm test              # Vitest run (35 tests, ~1초)
npm run test:watch    # Vitest watch
npm run lint          # ESLint 9 flat config
npm run format        # Prettier --write
npm run format:check  # Prettier --check (CI에서 사용)
```

CI 게이트 = `lint → format:check → test → build`. 로컬에서 4개 다 통과시키면 CI도 통과한다.

## 컨벤션

- **색상/치수는 Tailwind 토큰**으로. 새 색상은 `tailwind.config.js`의 `theme.extend.colors.shokz.*`에, 새 치수는 `gfa-*` 너비/높이 토큰에 추가한 뒤 클래스로 사용한다.
- **인라인 `style`은 픽셀 정확도가 필요한 곳에만** (1200×1200 캔버스 합성, 오프스크린 좌표 등). 일반 레이아웃은 Tailwind 클래스.
- **`src/engine/` 모듈은 React 의존 금지**. 순수 함수 + 어댑터만. 새 로직은 여기 추가하고 `__tests__/`에 케이스를 같이 작성.
- **부수효과 격리**: html-to-image / ObjectURL / 다운로드 / fetch 등은 모두 `src/engine/`의 명시적 모듈 안에서만 일어난다. 컴포넌트는 호출만 한다.
- **카피 길이 가드**: 헤드라인 40 / 설명 45 / CTA 8자. `lintCopy()`가 코드포인트 기준으로(이모지 = 1) 카운트한다.
- **한국어 폰트 스택**: `font-kr` 클래스 = Pretendard Variable → Pretendard → Noto Sans KR → Apple SD Gothic Neo → system. CDN은 `index.html`에서 로드.

## 데이터 흐름

```
brief (LLM) ──┐
              ├─→ generateVariants ─→ injectVariant ─┐
creatives.json┘                       │              ├─→ variants[]
                                      └─ assetResolver┘    │
                                                           ├─→ GfaPreview / GfaCreative1200
                                                           ├─→ exportPng (PNG)
                                                           └─→ exportDataset (JSON)
큐 jobs[] ─→ batchRunner ─→ BatchHost(오프스크린) ─→ JSZip ─→ ZIP
```

`injectVariant`는 모든 진입점의 정규화 게이트다. 카피 추가/이미지 변경/JSON 임포트/배치 — 전부 이걸 거치게 한다.

## LLM 어댑터 (Ollama)

- 기본 엔드포인트: `http://localhost:11434/api/generate`
- 기본 모델: `qwen2.5:7b` (한국어 지시 추종 안정). 대안: `gemma2:9b`, `exaone3.5:7.8b`.
- `format: "json"` + 스키마 검증으로 구조화 출력 강제.
- **CORS 주의**: 브라우저 직접 호출이라 Ollama 측에 origin 허용이 필요.
  ```bash
  OLLAMA_ORIGINS="http://localhost:5173" ollama serve
  ```
- 후보 N개 생성 시 temperature spread (0.75 → +0.07/후보) + diversity hint 5종 로테이션.

## 알려진 한계 / 함정

- **이미지 CORS**: `image.src`가 외부 호스트면 html-to-image 캡처가 실패. 동일 출처(`/products/`) 또는 anonymous CORS 허용 CDN을 사용.
- **`blob:` ObjectURL은 비영속**: 업로드 이미지를 `creatives.json`으로 export할 때 자동으로 빈 문자열로 스트립한다(다른 기기에서 못 읽음). 영속이 필요하면 별도 백엔드 업로드 단계가 필요.
- **배치 메모리**: JSZip 인메모리 누적이라 큐가 매우 크면(수백 jobs) 메모리 압박. 현실적으로 한 번에 ~20 job 이하 권장.
- **단일 GPU 직렬 추론** 가정: 7950X + 단일 GPU 상정으로 LLM 호출은 모두 직렬. 병렬화 시 Ollama 측 큐잉이 직렬이라 무의미.
- **루트 `index.html`/`assets/`**는 별도 프로젝트. CLAUDE.md 작업 범위에서 의도적으로 제외.

## 작업 브랜치

작업은 `claude/gfa-preview-component-5hRiU` 위에 누적해 왔다. 새 하위 브랜치를 파지 말고 같은 브랜치에 푸시할 것 — 사용자 가이드라인.

## Shokz 브랜드 토큰 (요약)

| 토큰 | HEX | 용도 |
|---|---|---|
| `shokz-blue` | `#0099E5` | Primary, CTA |
| `shokz-blue-deep` | `#0077B6` | CTA hover |
| `shokz-blue-ink` | `#003B73` | 그라디언트 끝 |
| `shokz-ink` | `#111111` | 본문 헤드라인 |
| `shokz-sub` | `#5B6470` | 서브 카피 |
| `shokz-line` | `#E5E7EB` | 디바이더 |
| `shokz-feed-bg` | `#F2F3F5` | 네이버 피드 배경 |
