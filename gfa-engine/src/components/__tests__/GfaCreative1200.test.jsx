import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GfaCreative1200 from "../GfaCreative1200.jsx";

const COPY = {
  headline: "1200 헤드라인",
  description: "프로모션 카피",
  ctaText: "구매하기",
};

describe("GfaCreative1200", () => {
  it("renders headline + description + CTA + brand lockup", () => {
    render(
      <GfaCreative1200
        copy={COPY}
        image={{}}
        axis={{ audience: "runner", tone: "performance" }}
      />
    );
    expect(screen.getByText("1200 헤드라인")).toBeInTheDocument();
    expect(screen.getByText("프로모션 카피")).toBeInTheDocument();
    expect(screen.getByText("구매하기")).toBeInTheDocument();
    expect(screen.getByText("SHOKZ")).toBeInTheDocument();
    expect(screen.getByText("BONE CONDUCTION")).toBeInTheDocument();
    expect(screen.getByText("AD · SHOKZ.CO.KR")).toBeInTheDocument();
  });

  it("renders the audience-specific tint label", () => {
    render(
      <GfaCreative1200
        copy={COPY}
        image={{}}
        axis={{ audience: "cyclist", tone: "performance" }}
      />
    );
    expect(screen.getByText("RIDE")).toBeInTheDocument();
  });

  it("falls back to default tint label when audience unknown", () => {
    render(<GfaCreative1200 copy={COPY} image={{}} axis={{ audience: "alien" }} />);
    // commuter is the default
    expect(screen.getByText("COMMUTE")).toBeInTheDocument();
  });

  it("auto-extracts promo badge from '최대 N% 할인' pattern", () => {
    render(
      <GfaCreative1200
        copy={{ ...COPY, description: "신제품 출시 기념 최대 18% 할인" }}
        image={{}}
        axis={{ audience: "runner", tone: "performance" }}
      />
    );
    expect(screen.getByText("최대 18%")).toBeInTheDocument();
  });

  it("auto-extracts promo badge from '신제품 출시' pattern", () => {
    render(
      <GfaCreative1200
        copy={{ ...COPY, description: "이번 주 신제품 출시 D-3" }}
        image={{}}
        axis={{ audience: "runner", tone: "performance" }}
      />
    );
    expect(screen.getByText("신제품 출시")).toBeInTheDocument();
  });

  it("renders <img> when image.src provided", () => {
    render(
      <GfaCreative1200
        copy={COPY}
        image={{ src: "/products/runner.svg", alt: "alt-text" }}
        axis={{ audience: "runner" }}
      />
    );
    const img = screen.getByAltText("alt-text");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "/products/runner.svg");
  });
});
