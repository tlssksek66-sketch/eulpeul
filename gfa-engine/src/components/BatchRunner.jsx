import React, { useId, useRef, useState } from "react";

const SAMPLE_JOBS = [
  {
    id: "shokz-2026-q2-launch",
    campaign: { platform: "NAVER_GFA", placement: "MOBILE_FEED_1200" },
    brief: {
      brand: "SHOKZ KOREA",
      product: "OpenRun Pro 2 골전도 헤드셋",
      promo: "신제품 출시 기념 최대 18% 할인",
    },
  },
  {
    id: "shokz-2026-q3-cycling",
    campaign: { platform: "NAVER_GFA", placement: "MOBILE_FEED_1200" },
    brief: {
      brand: "SHOKZ KOREA",
      product: "OpenRun Pro 2",
      promo: "사이클링 시즌 한정가 + 사은품",
    },
  },
];

export default function BatchRunner({ onRun, busy, log }) {
  const [text, setText] = useState(() => JSON.stringify(SAMPLE_JOBS, null, 2));
  const [parseError, setParseError] = useState(null);
  const fileRef = useRef(null);
  const headingId = useId();
  const helpId = useId();
  const errorId = useId();

  const handleRun = () => {
    let jobs;
    try {
      jobs = JSON.parse(text);
    } catch (e) {
      setParseError("JSON 파싱 실패: " + e.message);
      return;
    }
    if (!Array.isArray(jobs)) {
      setParseError("최상위는 배열이어야 합니다.");
      return;
    }
    setParseError(null);
    onRun(jobs);
  };

  const handleLoadFile = async (file) => {
    if (!file) return;
    const t = await file.text();
    setText(t);
    setParseError(null);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-shokz-line bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="rounded bg-shokz-ink/10 px-2 py-0.5 text-[11px] font-bold tracking-kr text-shokz-ink"
          >
            BATCH
          </span>
          <h2
            id={headingId}
            className="text-base font-bold tracking-kr-tight text-shokz-ink"
          >
            큐 배치 실행 (LLM → 렌더 → ZIP)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded border border-shokz-line bg-white px-2.5 py-1 text-[11px] font-semibold tracking-kr text-shokz-ink hover:border-shokz-blue hover:text-shokz-blue disabled:opacity-50"
          >
            파일 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              handleLoadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => setText(JSON.stringify(SAMPLE_JOBS, null, 2))}
            disabled={busy}
            className="rounded border border-shokz-line bg-white px-2.5 py-1 text-[11px] font-semibold tracking-kr text-shokz-sub hover:border-shokz-blue hover:text-shokz-blue disabled:opacity-50"
          >
            샘플
          </button>
        </div>
      </div>

      <p id={helpId} className="mt-3 text-[11px] text-shokz-sub">
        각 job은 <code className="rounded bg-neutral-100 px-1 text-[10px]">brief</code>
        (LLM 생성) 또는{" "}
        <code className="rounded bg-neutral-100 px-1 text-[10px]">variants</code>(명시
        카피) 중 하나를 가질 수 있습니다. 결과는{" "}
        <code className="rounded bg-neutral-100 px-1 text-[10px]">job.id/</code> 폴더
        단위로 묶인 ZIP으로 다운로드됩니다.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={10}
        spellCheck={false}
        aria-label="배치 작업 큐 JSON"
        aria-describedby={parseError ? `${helpId} ${errorId}` : helpId}
        aria-invalid={parseError ? "true" : undefined}
        className="mt-3 w-full rounded-md border border-shokz-line bg-neutral-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-shokz-ink outline-none focus:border-shokz-blue disabled:opacity-50"
      />

      {parseError && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700"
        >
          <span aria-hidden="true">⚠ </span>
          {parseError}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-shokz-sub">
          {busy ? "실행 중 — 큐가 끝나면 ZIP이 자동 다운로드됩니다." : "준비 완료."}
        </p>
        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className="rounded-lg bg-shokz-ink px-4 py-2 text-[13px] font-bold tracking-kr text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "실행 중..." : "큐 실행"}
        </button>
      </div>

      {log && log.length > 0 && (
        <div
          role="log"
          aria-live="polite"
          aria-label="배치 진행 로그"
          className="mt-3 max-h-48 overflow-auto rounded-md border border-shokz-line bg-neutral-50 p-2 font-mono text-[11px] leading-relaxed text-shokz-sub"
        >
          {log.map((line, idx) => (
            <div key={idx} className="whitespace-pre">
              {line}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
