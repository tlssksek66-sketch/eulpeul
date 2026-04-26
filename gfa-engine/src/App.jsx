import React, { useCallback, useMemo, useRef, useState } from "react";
import GfaPreview from "./components/GfaPreview.jsx";
import GfaCreative1200 from "./components/GfaCreative1200.jsx";
import CopyGenerator from "./components/CopyGenerator.jsx";
import CandidatePicker from "./components/CandidatePicker.jsx";
import BatchRunner from "./components/BatchRunner.jsx";
import BatchHost from "./components/BatchHost.jsx";
import dataset from "./engine/creatives.json";
import { injectAll, injectVariant } from "./engine/inject.js";
import { generateCopyCandidates } from "./engine/copyAdapter.js";
import { exportNodePng, exportAllPng, buildFilename } from "./engine/exportPng.js";
import {
  downloadCreativesJson,
  readCreativesJson,
} from "./engine/exportDataset.js";
import { runBatch, downloadBatchZip } from "./engine/batchRunner.js";

const SEED = injectAll(dataset);

const DEFAULT_BRIEF = {
  brand: dataset.defaults.brandName ?? "SHOKZ KOREA",
  product: "OpenRun Pro 2 골전도 헤드셋",
  promo: "신제품 출시 기념 최대 18% 할인",
};

const DEFAULT_LLM_CONFIG = {
  endpoint: "http://localhost:11434/api/generate",
  model: "qwen2.5:7b",
};

const CANDIDATE_COUNT = 3;

export default function App() {
  const [variants, setVariants] = useState(SEED);
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [llmConfig, setLlmConfig] = useState(DEFAULT_LLM_CONFIG);
  const [candState, setCandState] = useState({}); // { [variantId]: {items, busy, progress, error} }

  const cardRefs = useRef({});
  const creativeRefs = useRef({});
  const fileInputRef = useRef(null);
  const uploadInputRefs = useRef({});
  const [busy, setBusy] = useState(null);

  // 배치 모드
  const [batchActiveJob, setBatchActiveJob] = useState(null);
  const batchReadyResolverRef = useRef(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchLog, setBatchLog] = useState([]);

  const handleBatchHostReady = useCallback((refs) => {
    const resolve = batchReadyResolverRef.current;
    batchReadyResolverRef.current = null;
    if (resolve) resolve(refs);
  }, []);

  const mountAndCapture = useCallback(
    (jobShell) =>
      new Promise((resolve) => {
        batchReadyResolverRef.current = resolve;
        setBatchActiveJob(jobShell);
      }),
    []
  );

  const handleRunBatch = async (jobs) => {
    setBatchBusy(true);
    setBatchLog([`▶ ${jobs.length}개 job 시작`]);
    const append = (line) =>
      setBatchLog((prev) => [...prev, line].slice(-200));
    try {
      const { blob, summary } = await runBatch({
        jobs,
        baseDataset: dataset,
        llmConfig,
        mountAndCapture,
        onProgress: (e) => {
          switch (e.stage) {
            case "start":
              append(`[${e.jobIndex + 1}/${e.jobsTotal}] ${e.jobId} — 시작`);
              break;
            case "skip-llm":
              append(`  · LLM 스킵 (명시 variants 사용)`);
              break;
            case "generating":
              append(`  · LLM 카피 생성 중...`);
              break;
            case "gen-step":
              if (e.status === "ok")
                append(`    ✓ ${e.axis?.audience}/${e.axis?.tone}`);
              break;
            case "rendering":
              append(`  · 오프스크린 렌더`);
              break;
            case "capturing":
              append(
                `  · 캡처 ${e.variantIndex + 1}/${e.variantsTotal} (${e.variantId})`
              );
              break;
            case "done":
              append(`✓ ${e.jobId} 완료`);
              break;
            case "zipping":
              append(`▣ ZIP 생성`);
              break;
            default:
              break;
          }
        },
      });
      append(`✔ 전체 완료 — ${summary.length}개 job, 다운로드 시작`);
      downloadBatchZip(blob);
    } catch (e) {
      console.error("[gfa-engine] batch 실패:", e);
      append(`✗ 실패: ${e.message}`);
      alert(`배치 실패: ${e.message}`);
    } finally {
      setBatchActiveJob(null);
      setBatchBusy(false);
    }
  };

  const headerMeta = useMemo(
    () => ({
      platform: dataset.campaign.platform,
      placement: dataset.campaign.placement,
      campaignId: dataset.campaign.id,
    }),
    []
  );

  const handleGenerated = (raw) => {
    setVariants(raw.map((v) => injectVariant(dataset, v)));
    setCandState({}); // 새 데이터셋이면 후보는 폐기
  };

  const handleResetSeed = () => {
    setVariants(SEED);
    setCandState({});
  };

  const handleImageUpload = (variantId, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, image: { ...v.image, src: url, alt: file.name } }
          : v
      )
    );
  };

  const handleClearImage = (variantId) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        if (v.image?.src?.startsWith("blob:")) URL.revokeObjectURL(v.image.src);
        return injectVariant(dataset, {
          id: v.id,
          axis: v.axis,
          copy: v.copy,
          image: { src: "", alt: "" },
        });
      })
    );
  };

  const handleDownloadJson = () => {
    downloadCreativesJson(dataset, variants);
  };

  const handleImportJson = async (file) => {
    if (!file) return;
    try {
      const data = await readCreativesJson(file);
      const merged = { ...dataset, ...data };
      setVariants(merged.variants.map((v) => injectVariant(merged, v)));
      setCandState({});
    } catch (e) {
      console.error("[gfa-engine] JSON 가져오기 실패:", e);
      alert(`JSON 가져오기 실패: ${e.message}`);
    }
  };

  // ---- 카피 후보 ----
  const setVariantCandState = (variantId, patch) => {
    setCandState((prev) => ({
      ...prev,
      [variantId]: { ...(prev[variantId] ?? {}), ...patch },
    }));
  };

  const runCandidateGen = async (variantId, axis) => {
    setVariantCandState(variantId, {
      items: null,
      busy: true,
      progress: { index: 0, total: CANDIDATE_COUNT },
      error: null,
    });
    try {
      const items = await generateCopyCandidates({
        brief,
        axis,
        n: CANDIDATE_COUNT,
        endpoint: llmConfig.endpoint,
        model: llmConfig.model,
        onProgress: (p) =>
          setVariantCandState(variantId, { progress: p, busy: true }),
      });
      setVariantCandState(variantId, { items, busy: false, progress: null });
    } catch (e) {
      console.error("[gfa-engine] candidate gen 실패:", e);
      setVariantCandState(variantId, {
        busy: false,
        error:
          e.message + " — Ollama 실행 / OLLAMA_ORIGINS 설정을 확인하세요.",
      });
    }
  };

  const handleOpenCandidates = (variant) => runCandidateGen(variant.id, variant.axis);
  const handleCloseCandidates = (variantId) =>
    setCandState((prev) => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });

  const handlePickCandidate = (variantId, copy) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? injectVariant(dataset, {
              id: v.id,
              axis: v.axis,
              copy: { ...v.copy, ...copy },
              image: { src: v.image?.src ?? "", alt: v.image?.alt ?? "" },
            })
          : v
      )
    );
    handleCloseCandidates(variantId);
  };

  // ---- PNG 내보내기 ----
  const handleExportMockup = async (variantId) => {
    setBusy(`mockup:${variantId}`);
    try {
      await exportNodePng(
        cardRefs.current[variantId],
        buildFilename(dataset.campaign.id, `${variantId}_mockup`),
        { pixelRatio: 3 }
      );
    } catch (e) {
      alert(`지면 시안 PNG 실패: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleExportCreative = async (variantId) => {
    setBusy(`creative:${variantId}`);
    try {
      await exportNodePng(
        creativeRefs.current[variantId],
        buildFilename(dataset.campaign.id, `${variantId}_1200x1200`),
        { pixelRatio: 1, width: 1200, height: 1200 }
      );
    } catch (e) {
      alert(`1200×1200 PNG 실패: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleExportAllMockup = async () => {
    setBusy("all:mockup");
    try {
      await exportAllPng(
        variants.map((v) => ({
          node: cardRefs.current[v.id],
          filename: buildFilename(dataset.campaign.id, `${v.id}_mockup`),
        })),
        { pixelRatio: 3 }
      );
    } catch (e) {
      alert(`일괄 mockup 실패: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleExportAllCreative = async () => {
    setBusy("all:creative");
    try {
      await exportAllPng(
        variants.map((v) => ({
          node: creativeRefs.current[v.id],
          filename: buildFilename(dataset.campaign.id, `${v.id}_1200x1200`),
        })),
        { pixelRatio: 1, width: 1200, height: 1200 }
      );
    } catch (e) {
      alert(`일괄 1200×1200 실패: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 px-6 py-10">
      <header className="mx-auto mb-6 flex max-w-6xl items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-shokz-blue">
            {headerMeta.platform} · {headerMeta.placement}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-kr-tight text-shokz-ink">
            Shokz GFA Engine · V1
          </h1>
          <p className="mt-1 text-sm text-shokz-sub">
            캠페인 <code className="rounded bg-white px-1.5 py-0.5 text-[12px]">{headerMeta.campaignId}</code> ·
            variants {variants.length}건
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null}
            className="rounded-lg border border-shokz-line bg-white px-3 py-2 text-[12px] font-semibold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            JSON 가져오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              handleImportJson(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={busy !== null}
            className="rounded-lg border border-shokz-line bg-white px-3 py-2 text-[12px] font-semibold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            creatives.json 다운로드
          </button>
          <button
            type="button"
            onClick={handleResetSeed}
            disabled={busy !== null}
            className="rounded-lg border border-shokz-line bg-white px-3 py-2 text-[12px] font-semibold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            시드 초기화
          </button>
          <button
            type="button"
            onClick={handleExportAllMockup}
            disabled={busy !== null}
            className="rounded-lg border border-shokz-line bg-white px-3 py-2 text-[12px] font-bold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "all:mockup" ? "..." : "지면 시안 일괄 PNG"}
          </button>
          <button
            type="button"
            onClick={handleExportAllCreative}
            disabled={busy !== null}
            className="rounded-lg bg-shokz-ink px-3 py-2 text-[12px] font-bold tracking-kr text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "all:creative" ? "..." : "1200×1200 일괄 PNG"}
          </button>
        </div>
      </header>

      <div className="mx-auto mb-6 max-w-6xl">
        <CopyGenerator
          brief={brief}
          onBriefChange={setBrief}
          llmConfig={llmConfig}
          onLlmConfigChange={setLlmConfig}
          onGenerated={handleGenerated}
        />
      </div>

      <div className="mx-auto mb-8 max-w-6xl">
        <BatchRunner
          onRun={handleRunBatch}
          busy={batchBusy}
          log={batchLog}
        />
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {variants.map((v) => {
          const cand = candState[v.id];
          return (
            <section key={v.id} className="flex flex-col items-center">
              <div ref={(el) => (cardRefs.current[v.id] = el)}>
                <GfaPreview copy={v.copy} image={v.image} />
              </div>

              <div className="mt-4 w-gfa-feed">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-shokz-sub">
                  1200×1200 deliverable
                </p>
                <div
                  className="overflow-hidden rounded-lg border border-shokz-line"
                  style={{ width: 360, height: 360 }}
                >
                  <div
                    style={{
                      transform: "scale(0.3)",
                      transformOrigin: "top left",
                      width: 1200,
                      height: 1200,
                    }}
                  >
                    <GfaCreative1200 copy={v.copy} image={v.image} axis={v.axis} />
                  </div>
                </div>
              </div>

              <div className="mt-3 w-gfa-feed">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-shokz-sub">{v.id}</span>
                  <span className="text-[11px] text-shokz-sub">
                    {v.axis.audience} · {v.axis.tone}
                  </span>
                </div>

                {v.warnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[11px] text-amber-600">
                    {v.warnings.map((w) => (
                      <li key={w.field}>⚠ {w.message}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => uploadInputRefs.current[v.id]?.click()}
                    disabled={busy !== null}
                    className="flex-1 rounded-md border border-shokz-line bg-white px-3 py-1.5 text-[12px] font-semibold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    이미지 업로드
                  </button>
                  <input
                    ref={(el) => (uploadInputRefs.current[v.id] = el)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload(v.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleClearImage(v.id)}
                    disabled={busy !== null}
                    className="rounded-md border border-shokz-line bg-white px-3 py-1.5 text-[12px] font-semibold tracking-kr text-shokz-sub transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
                    title="기본 axis 자산으로 되돌림"
                  >
                    ↺
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCandidates(v)}
                    disabled={busy !== null || cand?.busy}
                    className="rounded-md border border-shokz-blue bg-white px-2 py-1.5 text-[12px] font-bold tracking-kr text-shokz-blue transition-colors hover:bg-shokz-blue/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    🎲 후보 {CANDIDATE_COUNT}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportMockup(v.id)}
                    disabled={busy !== null}
                    className="rounded-md border border-shokz-line bg-white px-2 py-1.5 text-[12px] font-semibold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `mockup:${v.id}` ? "..." : "지면 PNG"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCreative(v.id)}
                    disabled={busy !== null}
                    className="rounded-md bg-shokz-blue px-2 py-1.5 text-[12px] font-bold tracking-kr text-white transition-colors hover:bg-shokz-blue-deep disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `creative:${v.id}` ? "..." : "1200²"}
                  </button>
                </div>
              </div>

              {(cand?.busy || cand?.items || cand?.error) && (
                <CandidatePicker
                  candidates={cand?.items}
                  busy={cand?.busy}
                  progress={cand?.progress}
                  error={cand?.error}
                  onPick={(copy) => handlePickCandidate(v.id, copy)}
                  onRegenerate={() => runCandidateGen(v.id, v.axis)}
                  onClose={() => handleCloseCandidates(v.id)}
                />
              )}
            </section>
          );
        })}
      </main>

      {/* 오프스크린 1200x1200 네이티브 렌더 (인터랙티브 카드용) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {variants.map((v) => (
          <div
            key={`offscreen-${v.id}`}
            ref={(el) => (creativeRefs.current[v.id] = el)}
            style={{ width: 1200, height: 1200 }}
          >
            <GfaCreative1200 copy={v.copy} image={v.image} axis={v.axis} />
          </div>
        ))}
      </div>

      {/* 배치 작업 전용 오프스크린 호스트 */}
      <BatchHost activeJob={batchActiveJob} onReady={handleBatchHostReady} />
    </div>
  );
}
