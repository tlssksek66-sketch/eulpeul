/**
 * Copy/Image 자동 주입 파이프라인 — V1
 *
 * 데이터셋(JSON)의 variants[]를 GfaPreview가 받는 { copy, image } 형태로
 * 정규화한다. 검수 단계에서 카피 길이 가드도 같이 친다 (네이버 GFA 가이드:
 * 헤드라인 ≤ 40자 / 설명 ≤ 45자 / CTA ≤ 8자 권장).
 */

const LIMITS = {
  headline: 40,
  description: 45,
  ctaText: 8,
};

export function injectVariant(dataset, variant) {
  const defaults = dataset.defaults ?? {};
  const copy = {
    brandName: defaults.brandName,
    brandHandle: defaults.brandHandle,
    adLabel: defaults.adLabel,
    ...variant.copy,
  };
  const image = {
    profileFallback: defaults.profileFallback,
    ...variant.image,
  };
  return {
    id: variant.id,
    axis: variant.axis ?? {},
    copy,
    image,
    warnings: lintCopy(copy),
  };
}

export function injectAll(dataset) {
  return (dataset.variants ?? []).map((v) => injectVariant(dataset, v));
}

export function lintCopy(copy) {
  const warnings = [];
  for (const [field, max] of Object.entries(LIMITS)) {
    const value = copy[field];
    if (typeof value === "string" && [...value].length > max) {
      warnings.push({
        field,
        length: [...value].length,
        max,
        message: `${field} 길이 ${[...value].length}자 (권장 ${max}자 이내)`,
      });
    }
  }
  return warnings;
}
