import { describe, it, expect } from "vitest";
import { lintCopy, injectVariant, injectAll } from "../inject.js";

const SEED = {
  campaign: { id: "c", platform: "NAVER_GFA" },
  defaults: {
    brandName: "BRAND",
    brandHandle: "h",
    adLabel: "광고",
    profileFallback: "B",
  },
  variants: [
    {
      id: "v1",
      axis: { audience: "runner", tone: "performance" },
      copy: { headline: "h1", description: "d1", ctaText: "go" },
      image: { src: "", alt: "" },
    },
    {
      id: "v2",
      axis: { audience: "office", tone: "lifestyle" },
      copy: { headline: "h2", description: "d2", ctaText: "go" },
      image: { src: "https://cdn/x.jpg", alt: "explicit" },
    },
  ],
};

describe("lintCopy", () => {
  it("returns no warnings for in-limit copy", () => {
    expect(
      lintCopy({ headline: "짧은 카피", description: "짧음", ctaText: "구매" })
    ).toEqual([]);
  });

  it("warns on overlong headline (41+ chars)", () => {
    const headline = "가".repeat(41);
    const warnings = lintCopy({ headline, description: "ok", ctaText: "구매" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("headline");
    expect(warnings[0].length).toBe(41);
    expect(warnings[0].max).toBe(40);
  });

  it("counts code points (not UTF-16 units) for surrogate pairs", () => {
    const headline = "🚀".repeat(41);
    const warnings = lintCopy({ headline, description: "ok", ctaText: "go" });
    expect(warnings[0].length).toBe(41);
  });

  it("flags multiple fields independently", () => {
    const warnings = lintCopy({
      headline: "가".repeat(41),
      description: "나".repeat(46),
      ctaText: "다".repeat(9),
    });
    expect(warnings.map((w) => w.field).sort()).toEqual([
      "ctaText",
      "description",
      "headline",
    ]);
  });

  it("ignores non-string fields silently", () => {
    expect(lintCopy({ headline: undefined, description: null, ctaText: 42 })).toEqual([]);
  });
});

describe("injectVariant", () => {
  it("merges defaults into copy", () => {
    const out = injectVariant(SEED, SEED.variants[0]);
    expect(out.copy.brandName).toBe("BRAND");
    expect(out.copy.brandHandle).toBe("h");
    expect(out.copy.headline).toBe("h1");
  });

  it("resolves axis-default image when src is empty", () => {
    const out = injectVariant(SEED, SEED.variants[0]);
    expect(out.image.src).toBe("/products/runner.svg");
    expect(out.image.alt).toContain("러너");
  });

  it("preserves explicit src", () => {
    const out = injectVariant(SEED, SEED.variants[1]);
    expect(out.image.src).toBe("https://cdn/x.jpg");
    expect(out.image.alt).toBe("explicit");
  });

  it("computes lint warnings", () => {
    const v = {
      ...SEED.variants[0],
      copy: { headline: "가".repeat(50), description: "d", ctaText: "go" },
    };
    const out = injectVariant(SEED, v);
    expect(out.warnings.map((w) => w.field)).toContain("headline");
  });

  it("propagates axis as-is", () => {
    const out = injectVariant(SEED, SEED.variants[0]);
    expect(out.axis).toEqual({ audience: "runner", tone: "performance" });
  });
});

describe("injectAll", () => {
  it("maps every variant in dataset", () => {
    const out = injectAll(SEED);
    expect(out).toHaveLength(2);
    expect(out.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("returns empty array when variants missing", () => {
    expect(injectAll({ campaign: {}, defaults: {} })).toEqual([]);
  });
});
