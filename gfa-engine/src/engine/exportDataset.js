/**
 * Dataset Export — variants 상태를 creatives.json 호환 형태로 내려받기/올리기.
 *
 * round-trip: creatives.json ⇄ in-app variants 상태.
 * 업로드된 ObjectURL(blob:)은 영속이 불가능하므로 export 시 빈 문자열로 치환.
 */

export function serializeDataset(seedDataset, variants) {
  return {
    campaign: seedDataset.campaign,
    defaults: seedDataset.defaults,
    variants: variants.map((v) => ({
      id: v.id,
      axis: v.axis ?? {},
      copy: {
        headline: v.copy?.headline ?? "",
        description: v.copy?.description ?? "",
        ctaText: v.copy?.ctaText ?? "",
      },
      image: {
        src: stripBlob(v.image?.src ?? ""),
        alt: v.image?.alt ?? "",
      },
    })),
  };
}

export function downloadCreativesJson(seedDataset, variants, filename) {
  const payload = serializeDataset(seedDataset, variants);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${payload.campaign?.id ?? "creatives"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readCreativesJson(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data.variants)) {
    throw new Error("variants 배열이 없습니다.");
  }
  return data;
}

function stripBlob(src) {
  if (typeof src !== "string") return "";
  if (src.startsWith("blob:")) return "";
  return src;
}
