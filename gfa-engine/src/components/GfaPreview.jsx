import React from "react";

/**
 * GfaPreview — 네이버 GFA(GLAD for Advertiser) 모바일 피드 1200x1200 시안 미리보기
 *
 * 레퍼런스 스펙
 * - 메인 크리에이티브: 1200 x 1200 (1:1) → 미리보기 360x360 매핑
 * - 카드 폭: 360px / 피드 패딩 392px (네이버 모바일 피드 기준)
 * - 상단 프로필 영역(48px) + 정사각 이미지(360x360) + 본문(타이틀/설명/CTA)
 *
 * 색상/폰트는 tailwind.config.js의 theme.extend.colors.shokz / fontFamily.kr 토큰 사용.
 */

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
    <div className="inline-block select-none font-kr text-shokz-ink">
      {/* 피드 배경 (네이버 메인 피드 #F2F3F5) */}
      <div className="w-gfa-feed bg-shokz-feed-bg p-4">
        {/* 광고 카드 */}
        <article className="w-gfa-card overflow-hidden rounded-xl border border-shokz-line bg-shokz-surface shadow-gfa-card">
          {/* 1. 상단 프로필 영역 */}
          <header className="flex h-gfa-header items-center px-3">
            {/* 프로필 아바타 28x28 */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shokz-blue text-[12px] font-bold tracking-kr text-white">
              {profileSrc ? (
                <img
                  src={profileSrc}
                  alt={`${brandName} 프로필`}
                  width={28}
                  height={28}
                  className="h-7 w-7 object-cover"
                />
              ) : (
                profileFallback
              )}
            </div>

            {/* 브랜드명 + 핸들 */}
            <div className="ml-2 flex flex-col leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-bold tracking-kr text-shokz-ink">
                  {brandName}
                </span>
                <span className="rounded-[3px] bg-black/55 px-[5px] py-[1px] text-[10px] font-semibold leading-[1.4] tracking-kr text-white">
                  {adLabel}
                </span>
              </div>
              <span className="mt-[2px] text-[11px] tracking-kr text-shokz-sub">
                @{brandHandle}
              </span>
            </div>

            {/* 더보기(...) */}
            <button
              type="button"
              aria-label="더보기"
              className="ml-auto flex h-6 w-6 items-center justify-center bg-transparent text-shokz-sub"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="3.5" cy="9" r="1.4" fill="currentColor" />
                <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                <circle cx="14.5" cy="9" r="1.4" fill="currentColor" />
              </svg>
            </button>
          </header>

          {/* 2. 메인 크리에이티브 — 1:1, 360x360 표시 (원본 1200x1200) */}
          <div className="relative h-gfa-creative w-gfa-card overflow-hidden bg-[#0B0B0B]">
            {src ? (
              <img
                src={src}
                alt={alt}
                width={1200}
                height={1200}
                className="block h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-shokz-blue via-shokz-blue-deep to-shokz-blue-ink text-[13px] tracking-wider text-white/85">
                1200 × 1200 키비주얼
              </div>
            )}

            {/* 시안 식별용 워터마크 (실제 지면엔 없음) */}
            <span className="absolute left-2 top-2 rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/85">
              1200×1200
            </span>
          </div>

          {/* 3. 본문 영역 */}
          <div className="px-3 pb-[14px] pt-3">
            <h3 className="m-0 line-clamp-2 text-[15px] font-bold leading-[1.4] tracking-kr-tight text-shokz-ink">
              {headline}
            </h3>

            <p className="mt-1.5 line-clamp-2 text-[13px] font-normal leading-[1.45] tracking-kr text-shokz-sub">
              {description}
            </p>

            {/* CTA 버튼 */}
            <button
              type="button"
              className="mt-3 h-gfa-cta w-full rounded-lg bg-shokz-blue text-[14px] font-bold tracking-kr text-white transition-colors hover:bg-shokz-blue-deep"
            >
              {ctaText}
            </button>
          </div>

          {/* 4. 소셜 액션바 */}
          <div className="border-t border-shokz-line">
            <div className="flex h-10 items-center px-1">
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

        <p className="mt-2 text-[11px] tracking-kr text-shokz-sub">
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
      className="flex h-9 w-9 items-center justify-center bg-transparent text-[#3A3F47]"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        {children}
      </svg>
    </button>
  );
}
