import React from "react";

/**
 * GfaPreview — 네이버 GFA(GLAD for Advertiser) 모바일 피드 1200x1200 시안 미리보기
 *
 * 레퍼런스 스펙
 * - 메인 크리에이티브: 1200 x 1200 (1:1)
 * - 카드 폭: 모바일 피드 기준 360pt → 미리보기는 px 단위로 1:1 매핑
 * - 상단 프로필 영역(48px) + 정사각 이미지(360x360) + 본문(타이틀/설명/CTA)
 * - 폰트: Pretendard / Noto Sans KR (한글), system sans-serif fallback
 *
 * 샥즈(Shokz) 브랜드 가이드
 * - Primary  : #0099E5  (Shokz Blue)
 * - Ink      : #111111  (본문 헤드라인)
 * - Sub      : #5B6470  (서브 카피)
 * - Line     : #E5E7EB  (디바이더)
 * - Surface  : #FFFFFF  (카드 배경)
 * - Feed BG  : #F2F3F5  (네이버 피드 회색 배경)
 */

const SHOKZ = {
  blue: "#0099E5",
  blueDeep: "#0077B6",
  ink: "#111111",
  sub: "#5B6470",
  line: "#E5E7EB",
  surface: "#FFFFFF",
  feedBg: "#F2F3F5",
  adTagBg: "rgba(17,17,17,0.55)",
};

const FONT_STACK =
  "'Pretendard','Pretendard Variable','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,-apple-system,sans-serif";

export default function GfaPreview({ copy = {}, image = {} }) {
  const {
    brandName = "SHOKZ KOREA",
    brandHandle = "shokz_kr",
    headline = "귀를 막지 않는 골전도, 러닝의 자유를 입다.",
    description = "OpenRun Pro 2 · 신제품 출시 기념 최대 18% 할인",
    ctaText = "지금 구매하기",
    adLabel = "광고",
  } = copy;

  const {
    src = "",
    alt = "Shokz OpenRun Pro 2 키 비주얼",
    profileSrc = "",
    profileFallback = "S",
  } = image;

  return (
    <div
      className="inline-block select-none"
      style={{ fontFamily: FONT_STACK, color: SHOKZ.ink }}
    >
      {/* 피드 배경 (네이버 메인 피드와 동일한 #F2F3F5) */}
      <div
        className="p-4"
        style={{ backgroundColor: SHOKZ.feedBg, width: 392 }}
      >
        {/* 광고 카드 (모바일 피드 카드 폭 360px) */}
        <article
          className="overflow-hidden"
          style={{
            width: 360,
            backgroundColor: SHOKZ.surface,
            borderRadius: 12,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            border: `1px solid ${SHOKZ.line}`,
          }}
        >
          {/* 1. 상단 프로필 영역 — 높이 48px, 좌우 패딩 12px */}
          <header
            className="flex items-center"
            style={{ height: 48, padding: "0 12px" }}
          >
            {/* 프로필 이미지: 원형 28x28 */}
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: SHOKZ.blue,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                flexShrink: 0,
              }}
            >
              {profileSrc ? (
                <img
                  src={profileSrc}
                  alt={`${brandName} 프로필`}
                  width={28}
                  height={28}
                  style={{ width: 28, height: 28, objectFit: "cover" }}
                />
              ) : (
                profileFallback
              )}
            </div>

            {/* 브랜드명 + 핸들 */}
            <div className="flex flex-col" style={{ marginLeft: 8, lineHeight: 1.2 }}>
              <div className="flex items-center" style={{ gap: 4 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: SHOKZ.ink,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {brandName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#fff",
                    backgroundColor: SHOKZ.adTagBg,
                    padding: "1px 5px",
                    borderRadius: 3,
                    lineHeight: 1.4,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {adLabel}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: SHOKZ.sub,
                  letterSpacing: "-0.02em",
                  marginTop: 2,
                }}
              >
                @{brandHandle}
              </span>
            </div>

            {/* 더보기(...) 아이콘 — 우측 끝 */}
            <button
              type="button"
              aria-label="더보기"
              className="ml-auto flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                background: "transparent",
                border: "none",
                color: SHOKZ.sub,
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="3.5" cy="9" r="1.4" fill="currentColor" />
                <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                <circle cx="14.5" cy="9" r="1.4" fill="currentColor" />
              </svg>
            </button>
          </header>

          {/* 2. 메인 크리에이티브 — 1:1, 표시 360x360 (원본 1200x1200) */}
          <div
            className="relative"
            style={{
              width: 360,
              height: 360,
              backgroundColor: "#0B0B0B",
              overflow: "hidden",
            }}
          >
            {src ? (
              <img
                src={src}
                alt={alt}
                width={1200}
                height={1200}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center"
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(135deg,#0099E5 0%,#0077B6 60%,#003B73 100%)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  letterSpacing: "0.04em",
                }}
              >
                1200 × 1200 키비주얼
              </div>
            )}

            {/* 좌상단 1200x1200 워터마크 (시안 식별용, 실제 지면엔 없음) */}
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                background: "rgba(0,0,0,0.35)",
                padding: "2px 6px",
                borderRadius: 4,
                letterSpacing: "0.02em",
              }}
            >
              1200×1200
            </span>
          </div>

          {/* 3. 본문 영역 — 패딩 12px, 타이틀/설명/CTA */}
          <div style={{ padding: "12px 12px 14px 12px" }}>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.4,
                letterSpacing: "-0.025em",
                color: SHOKZ.ink,
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {headline}
            </h3>

            <p
              style={{
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: "-0.02em",
                color: SHOKZ.sub,
                margin: "6px 0 0 0",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>

            {/* CTA 버튼 — 샥즈 블루 풀 컬러 */}
            <button
              type="button"
              className="w-full"
              style={{
                marginTop: 12,
                height: 40,
                borderRadius: 8,
                backgroundColor: SHOKZ.blue,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                border: "none",
                cursor: "pointer",
                transition: "background-color .15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = SHOKZ.blueDeep;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = SHOKZ.blue;
              }}
            >
              {ctaText}
            </button>
          </div>

          {/* 4. 디바이더 + 소셜 액션바 (좋아요 / 댓글 / 공유 / 저장) */}
          <div style={{ borderTop: `1px solid ${SHOKZ.line}` }}>
            <div
              className="flex items-center"
              style={{ height: 40, padding: "0 4px" }}
            >
              <ActionIcon label="좋아요">
                <path
                  d="M9 15.5s-5.2-3-5.2-6.7A2.8 2.8 0 0 1 9 6.6a2.8 2.8 0 0 1 5.2 2.2c0 3.7-5.2 6.7-5.2 6.7Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </ActionIcon>
              <ActionIcon label="댓글">
                <path
                  d="M3.5 8.5C3.5 6 5.6 4 8.2 4h1.6c2.6 0 4.7 2 4.7 4.5S12.4 13 9.8 13H8l-2.5 2v-2.3C4.3 11.8 3.5 10.3 3.5 8.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </ActionIcon>
              <ActionIcon label="공유">
                <path
                  d="M12.5 6.5 6 9.5m6.5 3L6 9.5M14 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM6 9.5A1.5 1.5 0 1 1 3 9.5a1.5 1.5 0 0 1 3 0Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </ActionIcon>
              <span className="ml-auto" />
              <ActionIcon label="저장">
                <path
                  d="M5 4.5h8v10l-4-2.5-4 2.5v-10Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </ActionIcon>
            </div>
          </div>
        </article>

        {/* 시안 메타 (V1 자동화 엔진에서 다이얼로그 등으로 노출) */}
        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: SHOKZ.sub,
            letterSpacing: "-0.02em",
          }}
        >
          NAVER GFA · 모바일 피드 · 1200×1200 · Shokz V1
        </p>
      </div>
    </div>
  );
}

function ActionIcon({ label, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex items-center justify-center"
      style={{
        width: 36,
        height: 36,
        background: "transparent",
        border: "none",
        color: "#3A3F47",
        cursor: "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        {children}
      </svg>
    </button>
  );
}
