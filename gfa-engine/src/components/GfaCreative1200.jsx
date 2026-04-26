import React from "react";

/**
 * GfaCreative1200 — NAVER GFA 1200x1200 업로드 산출물(딜리버러블)
 *
 * 카드 chrome(프로필/CTA 등)은 제외한, 광고 지면에 실제로 송출되는 비주얼.
 * 네이티브 1200x1200 픽셀로 렌더해서 html-to-image로 1:1 캡처한다.
 *
 * 레이아웃
 * - top-left  : SHOKZ 로고락업 (60px 패딩)
 * - top-right : 제품 태그칩
 * - bottom    : 다크 그라디언트 오버레이 + 헤드라인(80px) + 설명 + CTA 칩
 * - axis별 그라디언트 틴트로 variant 시각적 차별화
 */

const TINT_BY_AUDIENCE = {
  runner: {
    gradient: "linear-gradient(135deg,#FF6B35 0%,#FF8E1C 22%,#0099E5 58%,#003B73 100%)",
    accent: "#FF8E1C",
    label: "RUN",
  },
  commuter: {
    gradient: "linear-gradient(135deg,#0099E5 0%,#0077B6 50%,#003B73 100%)",
    accent: "#0099E5",
    label: "COMMUTE",
  },
  cyclist: {
    gradient: "linear-gradient(135deg,#00E599 0%,#00B8D4 45%,#0077B6 100%)",
    accent: "#00E599",
    label: "RIDE",
  },
  office: {
    gradient: "linear-gradient(135deg,#5B6470 0%,#3A4150 45%,#003B73 100%)",
    accent: "#0099E5",
    label: "WORK",
  },
};

const DEFAULT_TINT = TINT_BY_AUDIENCE.commuter;

export default function GfaCreative1200({ copy = {}, image = {}, axis = {} }) {
  const tint = TINT_BY_AUDIENCE[axis.audience] ?? DEFAULT_TINT;
  const product = (copy.brandName ? "" : "") + "OpenRun Pro 2";
  const promoBadge = pickPromoBadge(copy.description);

  return (
    <div
      className="relative overflow-hidden font-kr text-white"
      style={{ width: 1200, height: 1200 }}
    >
      {/* 1) 배경 — image.src 우선, 없으면 axis 틴트 그라디언트 */}
      {image.src ? (
        <img
          src={image.src}
          alt={image.alt ?? ""}
          width={1200}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: tint.gradient }} />
      )}

      {/* 1-b) 노이즈/비넷 (텍스처 살짝) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)",
        }}
      />

      {/* 2) 하단 다크 그라디언트 (가독성 확보) */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "62%",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* 3) 상단 좌: 브랜드 락업 */}
      <div className="absolute flex items-center" style={{ left: 60, top: 60, gap: 18 }}>
        <ShokzMark size={64} />
        <div className="flex flex-col" style={{ lineHeight: 1.05 }}>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            SHOKZ
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.22em",
              opacity: 0.78,
              marginTop: 2,
            }}
          >
            BONE CONDUCTION
          </span>
        </div>
      </div>

      {/* 4) 상단 우: 제품 태그칩 + 축 라벨 */}
      <div className="absolute flex items-center" style={{ right: 60, top: 60, gap: 12 }}>
        <span
          style={{
            background: "rgba(255,255,255,0.16)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            padding: "10px 20px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          {product}
        </span>
        <span
          style={{
            background: tint.accent,
            color: "#0B0B0B",
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: "0.18em",
            padding: "10px 16px",
            borderRadius: 999,
          }}
        >
          {tint.label}
        </span>
      </div>

      {/* 5) 하단 카피 영역 */}
      <div
        className="absolute"
        style={{
          left: 80,
          right: 80,
          bottom: 110,
        }}
      >
        {promoBadge && (
          <span
            style={{
              display: "inline-block",
              background: tint.accent,
              color: "#0B0B0B",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              padding: "8px 16px",
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            {promoBadge}
          </span>
        )}

        <h2
          style={{
            margin: 0,
            fontSize: 80,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.045em",
            textShadow: "0 2px 24px rgba(0,0,0,0.35)",
          }}
        >
          {copy.headline}
        </h2>

        <p
          style={{
            margin: "28px 0 0 0",
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            opacity: 0.92,
            lineHeight: 1.4,
          }}
        >
          {copy.description}
        </p>
      </div>

      {/* 6) CTA 칩 (우하단) */}
      <div className="absolute" style={{ right: 80, bottom: 80 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#FFFFFF",
            color: "#0B0B0B",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            padding: "18px 28px",
            borderRadius: 999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {copy.ctaText}
          <Arrow size={22} />
        </span>
      </div>

      {/* 7) 좌하단 면적 채움: 광고 식별 (네이버 가이드 권장) */}
      <span
        className="absolute"
        style={{
          left: 80,
          bottom: 60,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.18em",
          opacity: 0.6,
        }}
      >
        AD · SHOKZ.CO.KR
      </span>
    </div>
  );
}

function ShokzMark({ size = 64 }) {
  // 골전도 아이덴티티를 형상화한 음파 마크
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="30" stroke="#fff" strokeWidth="3" />
      <path
        d="M20 32c0-6.6 5.4-12 12-12"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M26 32c0-3.3 2.7-6 6-6"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="2.5" fill="#fff" />
      <path
        d="M38 26c3.3 0 6 2.7 6 6s-2.7 6-6 6"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M38 20c6.6 0 12 5.4 12 12s-5.4 12-12 12"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Arrow({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <path
        d="M4 11h14M12 5l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// description에서 할인/% 패턴을 잡아 별도 배지로 노출
function pickPromoBadge(description = "") {
  const m =
    description.match(/(최대\s*\d{1,2}\s*%)/) ||
    description.match(/(\d{1,2}\s*%)\s*할인/) ||
    description.match(/(신제품\s*출시)/);
  return m ? m[1] : null;
}
