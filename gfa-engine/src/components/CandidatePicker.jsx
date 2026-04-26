import React from "react";
import { lintCopy } from "../engine/inject.js";

/**
 * CandidatePicker — 한 variant에 대해 LLM이 뽑은 N개 카피 후보를 비교/선택.
 * 인라인 패널로 카드 아래에 펼침. pick → 부모가 variant.copy 갱신.
 */
export default function CandidatePicker({
  candidates,
  busy,
  progress,
  error,
  onPick,
  onRegenerate,
  onClose,
}) {
  if (!candidates && !busy && !error) return null;

  return (
    <div className="mt-3 w-gfa-feed rounded-lg border border-shokz-blue/40 bg-shokz-blue/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-shokz-blue">
          카피 후보
          {candidates ? ` ${candidates.length}` : ""}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy}
            className="rounded border border-shokz-line bg-white px-2 py-0.5 text-[11px] font-semibold tracking-kr text-shokz-ink hover:border-shokz-blue hover:text-shokz-blue disabled:opacity-50"
          >
            재생성
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border border-shokz-line bg-white px-2 py-0.5 text-[11px] font-semibold tracking-kr text-shokz-sub hover:border-shokz-blue hover:text-shokz-blue disabled:opacity-50"
          >
            닫기
          </button>
        </div>
      </div>

      {busy && (
        <p className="mt-2 text-[11px] text-shokz-sub">
          생성 중 {progress ? `${progress.index + 1}/${progress.total}` : ""}...
        </p>
      )}

      {error && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
          ⚠ {error}
        </p>
      )}

      {candidates && candidates.length > 0 && (
        <ul className="mt-2 space-y-2">
          {candidates.map((c, idx) => {
            const warnings = lintCopy(c.copy);
            return (
              <li
                key={c.id}
                className="rounded-md border border-shokz-line bg-white p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-mono text-shokz-sub">
                      #{idx + 1}
                    </p>
                    <p className="mt-0.5 text-[13px] font-bold leading-snug tracking-kr-tight text-shokz-ink">
                      {c.copy.headline}
                    </p>
                    <p className="mt-0.5 text-[11px] tracking-kr text-shokz-sub">
                      {c.copy.description}
                    </p>
                    <p className="mt-1 inline-block rounded bg-shokz-blue/10 px-1.5 py-0.5 text-[10px] font-bold tracking-kr text-shokz-blue">
                      CTA · {c.copy.ctaText}
                    </p>
                    {warnings.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-[10px] text-amber-600">
                        {warnings.map((w) => (
                          <li key={w.field}>⚠ {w.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onPick(c.copy)}
                    disabled={busy}
                    className="shrink-0 self-center rounded-md bg-shokz-blue px-3 py-1.5 text-[11px] font-bold tracking-kr text-white hover:bg-shokz-blue-deep disabled:opacity-50"
                  >
                    적용
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
