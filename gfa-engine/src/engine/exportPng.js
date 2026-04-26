import { toPng } from "html-to-image";

/**
 * 시안 PNG 내보내기 — V1
 *
 * GFA 모바일 피드 카드(GfaPreview)를 그대로 렌더한 DOM 노드를 캡처하여
 * 다운로드 트리거. 클라이언트 리뷰용 고해상도(3x) 산출물이 기본값.
 *
 * 한계: 외부 호스트의 이미지(image.src)는 CORS가 허용되지 않으면 캡처가
 * 실패한다. 실제 자산은 동일 출처(public/) 또는 CORS 허용 CDN을 사용할 것.
 */

const DEFAULT_OPTIONS = {
  pixelRatio: 3,
  cacheBust: true,
  backgroundColor: "#F2F3F5",
};

export async function exportNodePng(node, filename, options = {}) {
  if (!node) throw new Error("export 대상 DOM 노드가 없습니다.");
  const dataUrl = await toPng(node, { ...DEFAULT_OPTIONS, ...options });
  triggerDownload(dataUrl, filename);
  return dataUrl;
}

/**
 * 다수 노드를 직렬로 다운로드. 브라우저가 동시 다운로드를 차단하는 경우가
 * 있어 sleep을 끼워넣는다.
 */
export async function exportAllPng(items, options = {}) {
  for (const { node, filename } of items) {
    if (!node) continue;
    await exportNodePng(node, filename, options);
    await sleep(120);
  }
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildFilename(campaignId, variantId, ext = "png") {
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${safe(campaignId)}__${safe(variantId)}.${ext}`;
}
