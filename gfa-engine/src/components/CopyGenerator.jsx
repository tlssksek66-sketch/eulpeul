import React, { useState } from "react";
import { generateVariants } from "../engine/copyAdapter.js";

const DEFAULT_AXES = [
  { audience: "runner", tone: "performance" },
  { audience: "commuter", tone: "safety" },
  { audience: "cyclist", tone: "performance" },
  { audience: "office", tone: "lifestyle" },
];

export default function CopyGenerator({
  brief,
  onBriefChange,
  llmConfig,
  onLlmConfigChange,
  onGenerated,
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setProgress({ index: 0, total: DEFAULT_AXES.length });
    try {
      const variants = await generateVariants({
        brief,
        axes: DEFAULT_AXES,
        endpoint: llmConfig.endpoint,
        model: llmConfig.model,
        onProgress: (p) => setProgress(p),
      });
      onGenerated(variants);
    } catch (e) {
      console.error("[gfa-engine] copy gen 실패:", e);
      setError(
        e.message +
          " — Ollama 실행/OLLAMA_ORIGINS에 현재 출처가 허용됐는지 확인하세요."
      );
    } finally {
      setBusy(false);
    }
  };

  const updateBrief = (k, v) => onBriefChange({ ...brief, [k]: v });
  const updateConfig = (k, v) => onLlmConfigChange({ ...llmConfig, [k]: v });

  return (
    <section className="rounded-xl border border-shokz-line bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-shokz-blue/10 px-2 py-0.5 text-[11px] font-bold tracking-kr text-shokz-blue">
          LLM
        </span>
        <h2 className="text-base font-bold tracking-kr-tight text-shokz-ink">
          카피 자동 생성 (로컬 Ollama)
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="브랜드" value={brief.brand} onChange={(v) => updateBrief("brand", v)} />
        <Field label="제품" value={brief.product} onChange={(v) => updateBrief("product", v)} />
        <Field
          label="프로모션/상황"
          value={brief.promo}
          onChange={(v) => updateBrief("promo", v)}
          className="md:col-span-2"
        />
        <Field
          label="모델"
          value={llmConfig.model}
          onChange={(v) => updateConfig("model", v)}
        />
        <Field
          label="Ollama 엔드포인트"
          value={llmConfig.endpoint}
          onChange={(v) => updateConfig("endpoint", v)}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-shokz-sub">
          축 {DEFAULT_AXES.length}개(runner·commuter·cyclist·office) 순차 생성. 변경은 카드 단위 후보 픽으로.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="rounded-lg bg-shokz-blue px-4 py-2 text-[13px] font-bold tracking-kr text-white transition-colors hover:bg-shokz-blue-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? `생성 중 ${progress ? `${progress.index + 1}/${progress.total}` : ""}`
            : "전체 축 카피 생성"}
        </button>
      </div>

      {progress && busy && (
        <p className="mt-3 text-[11px] text-shokz-sub">
          → {progress.axis?.audience} · {progress.axis?.tone} ({progress.status})
        </p>
      )}
      {error && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          ⚠ {error}
        </p>
      )}
    </section>
  );
}

function Field({ label, value, onChange, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold tracking-kr text-shokz-sub">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-shokz-line bg-white px-3 py-2 text-[13px] tracking-kr text-shokz-ink outline-none focus:border-shokz-blue"
      />
    </label>
  );
}
