import React, { useMemo, useRef, useState } from "react";
import GfaPreview from "./components/GfaPreview.jsx";
import GfaCreative1200 from "./components/GfaCreative1200.jsx";
import CopyGenerator from "./components/CopyGenerator.jsx";
import dataset from "./engine/creatives.json";
import { injectAll, injectVariant } from "./engine/inject.js";
import { exportNodePng, exportAllPng, buildFilename } from "./engine/exportPng.js";
import {
  downloadCreativesJson,
  readCreativesJson,
} from "./engine/exportDataset.js";

const SEED = injectAll(dataset);

export default function App() {
  const [variants, setVariants] = useState(SEED);
  const cardRefs = useRef({});
  const creativeRefs = useRef({});
  const fileInputRef = useRef(null);
  const uploadInputRefs = useRef({});
  const [busy, setBusy] = useState(null);

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
  };

  const handleResetSeed = () => setVariants(SEED);

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
        // 재인젝트로 axis 기본 자산 복원 (uploaded blob: URL은 폐기)
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
    } catch (e) {
      console.error("[gfa-engine] JSON 가져오기 실패:", e);
      alert(`JSON 가져오기 실패: ${e.message}`);
    }
  };

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

      <div className="mx-auto mb-8 max-w-6xl">
        <CopyGenerator onGenerated={handleGenerated} />
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {variants.map((v) => (
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

              {/* 이미지 업로드/초기화 */}
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

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleExportMockup(v.id)}
                  disabled={busy !== null}
                  className="rounded-md border border-shokz-line bg-white px-3 py-1.5 text-[12px] font-semibold tracking-kr text-shokz-ink transition-colors hover:border-shokz-blue hover:text-shokz-blue disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === `mockup:${v.id}` ? "..." : "지면 시안 PNG"}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCreative(v.id)}
                  disabled={busy !== null}
                  className="rounded-md bg-shokz-blue px-3 py-1.5 text-[12px] font-bold tracking-kr text-white transition-colors hover:bg-shokz-blue-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === `creative:${v.id}` ? "..." : "1200×1200 PNG"}
                </button>
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* 오프스크린 1200x1200 네이티브 렌더 */}
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
    </div>
  );
}
