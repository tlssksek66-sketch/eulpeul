/**
 * 로컬 LLM 카피 어댑터 — V1 (Ollama compatible)
 *
 * 7950X 환경에서 Ollama(http://localhost:11434)로 한국어 카피를 생성한다.
 * 권장 모델: qwen2.5:7b / gemma2:9b / exaone3.5:7.8b (한국어 지시 추종 우수).
 *
 * CORS: 브라우저에서 직접 호출하므로 Ollama 측에 origin 허용이 필요하다.
 *   OLLAMA_ORIGINS="http://localhost:5173" ollama serve
 */

const DEFAULT_ENDPOINT = "http://localhost:11434/api/generate";
const DEFAULT_MODEL = "qwen2.5:7b";

export const COPY_LIMITS = { headline: 40, description: 45, ctaText: 8 };

export async function generateCopy({
  brief,
  axis,
  endpoint = DEFAULT_ENDPOINT,
  model = DEFAULT_MODEL,
  temperature = 0.7,
  diversitySeed = 0,
  signal,
} = {}) {
  const prompt = buildPrompt({ brief, axis, diversitySeed });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      format: "json",
      stream: false,
      options: { temperature, seed: diversitySeed || undefined },
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama 응답 실패 (${res.status} ${res.statusText})`);
  }

  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.response);
  } catch {
    throw new Error(`LLM JSON 파싱 실패: ${data.response?.slice(0, 80)}...`);
  }

  return validateCopy(parsed);
}

/**
 * 한 axis에 대해 N개 후보 카피를 순차 생성. 7950X에서 단일 GPU 추론은 직렬이
 * 안전하다. temperature를 후보별로 살짝 흔들고(0.7 → 0.95) seed를 변형해
 * 다양성을 확보.
 */
export async function generateCopyCandidates({
  brief,
  axis,
  n = 3,
  baseTemperature = 0.75,
  onProgress,
  ...rest
} = {}) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    onProgress?.({ index: i, total: n, status: "start" });
    const copy = await generateCopy({
      brief,
      axis,
      temperature: clampTemp(baseTemperature + i * 0.07),
      diversitySeed: 1000 + i * 17,
      ...rest,
    });
    out.push({
      id: `cand-${axis.audience}-${stamp()}-${i}`,
      copy,
    });
    onProgress?.({ index: i, total: n, status: "ok" });
  }
  return out;
}

export async function generateVariants({ brief, axes, onProgress, ...rest } = {}) {
  const out = [];
  for (let i = 0; i < axes.length; i += 1) {
    const axis = axes[i];
    onProgress?.({ index: i, total: axes.length, axis, status: "start" });
    try {
      const copy = await generateCopy({ brief, axis, ...rest });
      out.push({
        id: `gen-${axis.audience}-${axis.tone}-${stamp()}`,
        axis,
        copy,
        image: { src: "", alt: `${brief.product} ${axis.audience} 시나리오` },
      });
      onProgress?.({ index: i, total: axes.length, axis, status: "ok" });
    } catch (err) {
      onProgress?.({ index: i, total: axes.length, axis, status: "fail", error: err });
      throw err;
    }
  }
  return out;
}

const DIVERSITY_HINTS = [
  "벤치마크: 직접적인 혜택 강조 (할인/스펙 우위).",
  "벤치마크: 감성적 후킹 (라이프스타일·정체성).",
  "벤치마크: 페인포인트 자극 (불편 해소).",
  "벤치마크: 사용 시나리오 묘사형.",
  "벤치마크: 통계/숫자 기반 신뢰형.",
];

function buildPrompt({ brief, axis, diversitySeed = 0 }) {
  const hint =
    diversitySeed > 0 ? DIVERSITY_HINTS[diversitySeed % DIVERSITY_HINTS.length] : null;
  return [
    "[역할] 너는 NAVER GFA(GLAD for Advertiser) 모바일 피드 1200x1200 광고의 한국어 카피라이터다.",
    `[브랜드] ${brief.brand}`,
    `[제품] ${brief.product}`,
    `[프로모션/상황] ${brief.promo ?? "(없음)"}`,
    `[타겟 오디언스] ${axis.audience}`,
    `[톤 앤 매너] ${axis.tone}`,
    hint && `[방향성] ${hint}`,
    "[제약]",
    `- headline: 한국어 ${COPY_LIMITS.headline}자 이내, 후킹 강하게.`,
    `- description: 한국어 ${COPY_LIMITS.description}자 이내, 혜택/근거 한 줄.`,
    `- ctaText: 한국어 ${COPY_LIMITS.ctaText}자 이내 동사형 (예: 지금 구매하기, 자세히 보기).`,
    "[출력 스키마]",
    '{"headline": "...", "description": "...", "ctaText": "..."}',
    "JSON 객체만 출력. 설명, 주석, 코드펜스 금지.",
  ]
    .filter(Boolean)
    .join("\n");
}

function clampTemp(t) {
  return Math.max(0.1, Math.min(1.5, t));
}

function validateCopy(obj) {
  if (!obj || typeof obj !== "object") {
    throw new Error("LLM 응답이 객체가 아닙니다.");
  }
  const out = {};
  for (const k of ["headline", "description", "ctaText"]) {
    if (typeof obj[k] !== "string" || obj[k].trim().length === 0) {
      throw new Error(`필수 필드 누락: ${k}`);
    }
    out[k] = obj[k].trim();
  }
  return out;
}

function stamp() {
  return Date.now().toString(36).slice(-5);
}
