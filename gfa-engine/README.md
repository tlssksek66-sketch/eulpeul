# Shokz GFA Engine · V1

NAVER GFA(GLAD for Advertiser) 모바일 피드 1200×1200 시안 자동화 엔진.
brief 입력부터 LLM 카피 생성, axis별 자산 매핑, 1200×1200 합성, PNG/JSON/ZIP
산출까지 한 사이클을 한 화면에서 닫는 React + Vite + Tailwind 데스크톱 앱.

7950X + 단일 GPU 환경에서 로컬 Ollama를 호출해 시안 카피를 생성하는 것을
전제한다.

> 본 디렉터리는 루트의 레거시 영업 기획 대시보드(`../index.html`, `../assets/`)와
> 무관하다. CI 워크플로우(`../.github/workflows/ci.yml`)도 `gfa-engine/` 변경에
> 한해 동작한다.

## 빠른 시작

```bash
cd gfa-engine
npm install

# (별도 터미널) Ollama를 dev origin 허용으로 띄움
OLLAMA_ORIGINS="http://localhost:5173" ollama serve

npm run dev          # http://localhost:5173
```

브라우저에서 직접 Ollama `/api/generate`를 호출하므로 **CORS 허용**이 필수.
원격 호스트에서 동작시키려면 해당 origin도 `OLLAMA_ORIGINS`에 추가.

## 명령

| 명령 | 용도 |
|---|---|
| `npm run dev` | Vite dev server (포트 5173, host:true) |
| `npm run build` | 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 산출물 로컬 확인 |
| `npm test` | Vitest 1회 실행 |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run lint` | ESLint 9 flat config |
| `npm run format` | Prettier `--write` |
| `npm run format:check` | Prettier `--check` (CI 게이트) |

CI 게이트 = `lint → format:check → test → build`. 로컬에서 4개 다 통과하면
`.github/workflows/ci.yml`도 통과한다.

## 한 사이클 흐름

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

`injectVariant()`는 모든 진입점의 정규화 게이트 — LLM 결과/JSON 임포트/배치
입력 모두 이걸 거쳐야 카피 길이 검증과 자산 해상도가 일관되게 적용된다.

## 디렉터리 맵

```
gfa-engine/
├── public/products/*.svg        axis별 1200×1200 플레이스홀더 자산
├── src/
│   ├── App.jsx                  최상위 화면 (상태 오너)
│   ├── main.jsx · index.css     엔트리 + Tailwind 베이스
│   ├── components/
│   │   ├── GfaPreview.jsx       모바일 피드 카드 (지면 시안)
│   │   ├── GfaCreative1200.jsx  실제 송출용 1200×1200 단독 비주얼
│   │   ├── CopyGenerator.jsx    LLM 4축 일괄 생성 패널
│   │   ├── CandidatePicker.jsx  variant별 후보 N개 비교/선택
│   │   ├── BatchRunner.jsx      큐 JSON 입력 + progress 로그
│   │   └── BatchHost.jsx        배치 작업 전용 오프스크린 렌더 호스트
│   └── engine/                  React 의존 없는 순수 모듈
│       ├── creatives.json       시드 데이터셋
│       ├── inject.js            injectVariant / injectAll / lintCopy
│       ├── assetResolver.js     axis → /products/*.svg 매핑
│       ├── copyAdapter.js       Ollama 호출 / generateCopy / generateCopyCandidates
│       ├── exportPng.js         html-to-image 래퍼 + buildFilename
│       ├── exportDataset.js     creatives.json 라운드트립
│       └── batchRunner.js       큐 처리 + 동적 JSZip 로드
├── tailwind.config.js           Shokz 브랜드 토큰
├── eslint.config.js · .prettierrc.json · vitest.config.js
└── package.json
```

## 컨벤션 (간단 요약)

- **색상/치수는 Tailwind 토큰**으로 일원화 (`theme.extend.colors.shokz.*`,
  `gfa-*` 너비/높이). 인라인 `style`은 픽셀 정확도가 필요한 곳(1200×1200
  캔버스 합성 등)만.
- **`src/engine/`는 React 의존 금지** — 순수 함수/어댑터만. 부수효과
  (html-to-image / ObjectURL / fetch / 다운로드)도 모두 여기서만.
- **카피 길이 가드** — 헤드라인 40 / 설명 45 / CTA 8자. `lintCopy()`가
  코드포인트 기준으로(이모지 = 1) 카운트.
- **한국어 폰트 스택** — `font-kr` = Pretendard Variable → Pretendard →
  Noto Sans KR → Apple SD Gothic Neo → system. CDN은 `index.html`에서 로드.

자세한 설계 의도와 함정은 [`CLAUDE.md`](../CLAUDE.md) 참고.

## LLM 어댑터 (Ollama)

- 기본 엔드포인트: `http://localhost:11434/api/generate`
- 기본 모델: `qwen2.5:7b` (한국어 지시 추종 안정).
  대안: `gemma2:9b`, `exaone3.5:7.8b` — 동일 인터페이스 교체.
- `format: "json"` + 스키마 검증으로 구조화 출력 강제.
- 후보 N개 생성 시 temperature spread (0.75 → +0.07/후보) +
  diversity hint 5종 로테이션.
- **CORS 주의**: 브라우저 직접 호출이라 `OLLAMA_ORIGINS`에 dev/preview
  origin이 등록돼야 한다.

## 번들 / 성능

- JSZip(~30 kB gzip)은 **동적 import**로 분리해 초기 로드에서 제외.
  배치 실행 시점에 처음 로드되며 이후 모듈 캐시로 재사용.
- 메인 번들 ≈ 64 kB gzip / CSS ≈ 4 kB gzip / JSZip 청크 ≈ 30 kB gzip.

## 접근성

- skip-to-main 링크와 `aria-live` 상태 영역으로 스크린리더가 배치 진행/
  PNG 내보내기 상태를 받을 수 있게 했다.
- 변형 카드(`<section>`)는 `aria-label`로 axis가 식별된다.
- 에러 메시지는 `role="alert"`, 진행 로그는 `role="log"` + `aria-live`.
- 텍스타리아·아이콘 전용 버튼(↺, 🎲)은 `aria-label`로 의미를 명시.

## 알려진 한계 / 함정

- **이미지 CORS** — `image.src`가 외부 호스트면 html-to-image 캡처 실패.
  동일 출처(`/products/`) 또는 anonymous CORS CDN을 쓸 것.
- **`blob:` ObjectURL은 비영속** — 업로드 이미지는 `creatives.json` export
  시 자동으로 빈 문자열로 스트립 (다른 기기에서 못 읽음). 영속이 필요하면
  별도 백엔드 업로드 단계 필요.
- **배치 메모리** — JSZip 인메모리 누적이라 큐가 매우 크면(수백 jobs)
  메모리 압박. 현실적으로 한 번에 ~20 job 이하 권장.
- **단일 GPU 직렬 추론 가정** — 7950X + 단일 GPU 상정으로 LLM 호출은
  모두 직렬. 병렬화는 Ollama 측 큐잉이 직렬이라 무의미.

## 관련 문서

- [`../CLAUDE.md`](../CLAUDE.md) — 디렉터리 맵, 컨벤션, 데이터 흐름,
  Shokz 브랜드 토큰 표
- [`./src/engine/creatives.json`](./src/engine/creatives.json) — 시드
  데이터셋 (campaign + defaults + variants)
