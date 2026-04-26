import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GfaPreview from "../GfaPreview.jsx";

const COPY = {
  brandName: "TEST BRAND",
  brandHandle: "test_brand",
  headline: "테스트 헤드라인 카피입니다",
  description: "테스트 설명문구",
  ctaText: "지금 보기",
  adLabel: "광고",
};

describe("GfaPreview", () => {
  it("renders headline / description / CTA from copy prop", () => {
    render(<GfaPreview copy={COPY} image={{}} />);
    expect(screen.getByText("테스트 헤드라인 카피입니다")).toBeInTheDocument();
    expect(screen.getByText("테스트 설명문구")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 보기" })).toBeInTheDocument();
  });

  it("renders brand name + 광고 tag + handle", () => {
    render(<GfaPreview copy={COPY} image={{}} />);
    expect(screen.getByText("TEST BRAND")).toBeInTheDocument();
    expect(screen.getByText("광고")).toBeInTheDocument();
    expect(screen.getByText("@test_brand")).toBeInTheDocument();
  });

  it("renders profileFallback letter when profileSrc empty", () => {
    render(<GfaPreview copy={COPY} image={{ profileFallback: "S", profileSrc: "" }} />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("shows 1200x1200 watermark in preview (sanity)", () => {
    render(<GfaPreview copy={COPY} image={{}} />);
    expect(screen.getByText("1200×1200")).toBeInTheDocument();
  });

  it("renders default copy when prop is empty", () => {
    render(<GfaPreview />);
    // Default brandName is "SHOKZ KOREA"
    expect(screen.getByText("SHOKZ KOREA")).toBeInTheDocument();
  });
});
