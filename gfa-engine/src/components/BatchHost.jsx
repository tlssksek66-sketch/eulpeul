import React, { useEffect, useRef } from "react";
import GfaPreview from "./GfaPreview.jsx";
import GfaCreative1200 from "./GfaCreative1200.jsx";

/**
 * BatchHost — 배치 작업의 active job variants를 오프스크린에 마운트해
 * mockup/1200x1200 ref를 부모에 전달.
 *
 * 부모는 setActiveJob(job)으로 변경 → 이펙트가 두 프레임 대기 후 onReady(refs)
 * 호출. 두 프레임 대기는 이미지 디코딩/폰트 적용 안정화를 위함.
 */
export default function BatchHost({ activeJob, onReady }) {
  const refs = useRef({});

  useEffect(() => {
    if (!activeJob) return undefined;
    refs.current = {};
    let cancelled = false;
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        if (!cancelled) onReady(refs.current);
      });
      refs.current.__raf2 = id2;
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
      if (refs.current.__raf2) cancelAnimationFrame(refs.current.__raf2);
    };
  }, [activeJob, onReady]);

  if (!activeJob) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: -99999,
        top: 0,
        pointerEvents: "none",
      }}
    >
      {activeJob.variants.map((v) => (
        <div key={v.id} style={{ marginBottom: 8 }}>
          <div
            ref={(el) => {
              if (!refs.current[v.id]) refs.current[v.id] = {};
              refs.current[v.id].mockup = el;
            }}
          >
            <GfaPreview copy={v.copy} image={v.image} />
          </div>
          <div
            ref={(el) => {
              if (!refs.current[v.id]) refs.current[v.id] = {};
              refs.current[v.id].creative = el;
            }}
            style={{ width: 1200, height: 1200 }}
          >
            <GfaCreative1200 copy={v.copy} image={v.image} axis={v.axis} />
          </div>
        </div>
      ))}
    </div>
  );
}
