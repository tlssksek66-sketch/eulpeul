import JSZip from "jszip";
import { toBlob } from "html-to-image";
import { generateVariants } from "./copyAdapter.js";
import { injectVariant } from "./inject.js";
import { serializeDataset } from "./exportDataset.js";

/**
 * Batch Runner — V1
 *
 * 큐(jobs[])를 받아 각 job마다 카피 생성→오프스크린 렌더→PNG 캡처→ZIP 패키징
 * 까지 직렬로 처리. 7950X + 단일 GPU 가정에 맞춰 직렬 처리.
 *
 * Job 입력 스키마
 * {
 *   id: "campaign-id",
 *   brief?: { brand, product, promo },              // LLM 생성용 (선택)
 *   axes?: [{ audience, tone }, ...],                // 기본 4축
 *   variants?: [...]                                 // 명시 카피 (LLM 스킵)
 *   defaults?: {...}, campaign?: {...}               // creatives.json 호환 키
 * }
 *
 * 부모(React)는 mountAndCapture(variants) 콜백으로 오프스크린 렌더 + ref 회수
 * 를 책임지고, 본 모듈은 흐름 제어/캡처/ZIP만 담당한다.
 */

const DEFAULT_AXES = [
  { audience: "runner", tone: "performance" },
  { audience: "commuter", tone: "safety" },
  { audience: "cyclist", tone: "performance" },
  { audience: "office", tone: "lifestyle" },
];

export async function runBatch({
  jobs,
  baseDataset,
  llmConfig = {},
  mountAndCapture,
  onProgress,
  signal,
}) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error("jobs 배열이 비어 있습니다.");
  }

  const zip = new JSZip();
  const summary = [];

  for (let i = 0; i < jobs.length; i += 1) {
    if (signal?.aborted) throw new Error("배치 중단");
    const job = jobs[i];
    const jobId = job.id ?? `job-${i + 1}`;
    const folder = zip.folder(jobId);

    onProgress?.({
      stage: "start",
      jobIndex: i,
      jobsTotal: jobs.length,
      jobId,
    });

    // 1) variants 확보 — LLM 생성 또는 명시 입력
    const datasetForJob = mergeDataset(baseDataset, job);
    const axes = job.axes ?? DEFAULT_AXES;
    let variants;
    if (Array.isArray(job.variants) && job.variants.length > 0) {
      variants = job.variants.map((v) => injectVariant(datasetForJob, v));
      onProgress?.({ stage: "skip-llm", jobIndex: i, jobId });
    } else if (job.brief) {
      onProgress?.({ stage: "generating", jobIndex: i, jobId });
      const generated = await generateVariants({
        brief: job.brief,
        axes,
        endpoint: llmConfig.endpoint,
        model: llmConfig.model,
        onProgress: (p) =>
          onProgress?.({ stage: "gen-step", jobIndex: i, jobId, ...p }),
      });
      variants = generated.map((v) => injectVariant(datasetForJob, v));
    } else {
      throw new Error(`job[${jobId}]: brief 또는 variants 중 하나가 필요합니다.`);
    }

    // 2) 오프스크린 렌더 + ref 회수
    onProgress?.({ stage: "rendering", jobIndex: i, jobId });
    const refs = await mountAndCapture({ id: jobId, variants });

    // 3) variant마다 mockup + 1200x1200 PNG 캡처
    for (let j = 0; j < variants.length; j += 1) {
      if (signal?.aborted) throw new Error("배치 중단");
      const v = variants[j];
      onProgress?.({
        stage: "capturing",
        jobIndex: i,
        jobId,
        variantIndex: j,
        variantsTotal: variants.length,
        variantId: v.id,
      });

      const handle = refs[v.id];
      if (!handle?.mockup || !handle?.creative) {
        throw new Error(`ref 누락: ${v.id}`);
      }

      const mockupBlob = await toBlob(handle.mockup, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#F2F3F5",
      });
      const creativeBlob = await toBlob(handle.creative, {
        pixelRatio: 1,
        width: 1200,
        height: 1200,
        cacheBust: true,
      });

      folder.file(`${v.id}_mockup.png`, mockupBlob);
      folder.file(`${v.id}_1200x1200.png`, creativeBlob);
    }

    // 4) creatives.json 동봉
    const datasetSnapshot = serializeDataset(datasetForJob, variants);
    folder.file("creatives.json", JSON.stringify(datasetSnapshot, null, 2));

    summary.push({
      jobId,
      variants: variants.length,
      files: variants.length * 2 + 1,
    });
    onProgress?.({ stage: "done", jobIndex: i, jobId });
  }

  // 5) ZIP 생성
  onProgress?.({ stage: "zipping" });
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, summary };
}

export function downloadBatchZip(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `gfa-batch-${stamp()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function mergeDataset(base, job) {
  return {
    campaign: { ...(base?.campaign ?? {}), ...(job.campaign ?? {}), id: job.id ?? base?.campaign?.id },
    defaults: { ...(base?.defaults ?? {}), ...(job.defaults ?? {}) },
    variants: job.variants ?? [],
  };
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
