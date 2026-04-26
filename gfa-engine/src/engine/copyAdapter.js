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
  signal,
} = {}) {
  const prompt = buildPrompt({ brief, axis });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      format: "json",
      stream: false,
      options: { temperature },
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
  } catch (e) {
    throw new Error(`LLM JSON 파싱 실패: ${data.response?.slice(0, 80)}...`);
  }

  return validateCopy(parsed);
}

export async function generateVariants({
  brief,
  axes,
  onProgress,
  ...rest
} = {}) {
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

function buildPrompt({ brief, axis }) {
  return [
    "[역할] 너는 NAVER GFA(GLAD for Advertiser) 모바일 피드 1200x1200 광고의 한국어 카피라이터다.",
    `[브랜드] ${brief.brand}`,
    `[제품] ${brief.product}`,
    `[프로모션/상황] ${brief.promo ?? "(없음)"}`,
    `[타겟 오디언스] ${axis.audience}`,
    `[톤 앤 매너] ${axis.tone}`,
    "[제약]",
    `- headline: 한국어 ${COPY_LIMITS.headline}자 이내, 후킹 강하게.`,
    `- description: 한국어 ${COPY_LIMITS.description}자 이내, 혜택/근거 한 줄.`,
    `- ctaText: 한국어 ${COPY_LIMITS.ctaText}자 이내 동사형 (예: 지금 구매하기, 자세히 보기).`,
    "[출력 스키마]",
    '{"headline": "...", "description": "...", "ctaText": "..."}',
    "JSON 객체만 출력. 설명, 주석, 코드펜스 금지.",
  ].join("\n");
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
