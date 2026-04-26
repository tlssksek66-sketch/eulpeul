import React from "react";
import GfaPreview from "./components/GfaPreview.jsx";
import dataset from "./engine/creatives.json";
import { injectAll } from "./engine/inject.js";

export default function App() {
  const variants = injectAll(dataset);

  return (
    <div className="min-h-screen bg-neutral-100 px-6 py-10">
      <header className="mx-auto mb-8 max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-shokz-blue">
          {dataset.campaign.platform} · {dataset.campaign.placement}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-kr-tight text-shokz-ink">
          Shokz GFA Engine · V1
        </h1>
        <p className="mt-1 text-sm text-shokz-sub">
          캠페인 <code className="rounded bg-white px-1.5 py-0.5 text-[12px]">{dataset.campaign.id}</code> ·
          variants {variants.length}건 자동 주입
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {variants.map((v) => (
          <section key={v.id} className="flex flex-col items-center">
            <GfaPreview copy={v.copy} image={v.image} />

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
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
