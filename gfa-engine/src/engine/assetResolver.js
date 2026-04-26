/**
 * Asset Resolver — V1
 *
 * variant.axis.audience 기준으로 기본 이미지(public/products/*.svg)를 매핑.
 * 명시적인 image.src가 있으면 그것을 우선하고, 빈 값일 때만 자동 주입한다.
 *
 * 실제 자산이 들어오면 동일 경로를 photo로 교체하면 된다.
 *   public/products/runner.svg   → runner.jpg
 *   public/products/commuter.svg → commuter.jpg ...
 */

const ASSETS_BY_AUDIENCE = {
  runner: "/products/runner.svg",
  commuter: "/products/commuter.svg",
  cyclist: "/products/cyclist.svg",
  office: "/products/office.svg",
};

const ALT_BY_AUDIENCE = {
  runner: "Shokz × 러너 키비주얼",
  commuter: "Shokz × 출퇴근 시나리오",
  cyclist: "Shokz × 사이클링 시나리오",
  office: "Shokz × 오피스 라이프스타일",
};

export function resolveAssetByAxis(axis) {
  return ASSETS_BY_AUDIENCE[axis?.audience] ?? "";
}

export function resolveAltByAxis(axis) {
  return ALT_BY_AUDIENCE[axis?.audience] ?? "Shokz 키비주얼";
}

/**
 * variant.image를 받아 src가 비어 있으면 axis 기반 기본값을 채워 반환.
 * 사용자가 업로드한 ObjectURL(blob:)/외부 URL은 그대로 보존.
 */
export function resolveVariantImage(image, axis) {
  if (image?.src) return image;
  const src = resolveAssetByAxis(axis);
  if (!src) return image;
  return {
    ...image,
    src,
    alt: image?.alt || resolveAltByAxis(axis),
  };
}

export function listAxisAssets() {
  return Object.entries(ASSETS_BY_AUDIENCE).map(([audience, src]) => ({
    audience,
    src,
    alt: ALT_BY_AUDIENCE[audience],
  }));
}
