import { describe, it, expect } from "vitest";
import { serializeDataset } from "../exportDataset.js";

const SEED = {
  campaign: { id: "test-camp", platform: "NAVER_GFA", placement: "MOBILE_FEED_1200" },
  defaults: { brandName: "X", profileFallback: "X" },
};

const baseVariant = {
  id: "v1",
  axis: { audience: "runner", tone: "performance" },
  copy: { headline: "h", description: "d", ctaText: "go" },
  image: { src: "/products/runner.svg", alt: "alt" },
};

describe("serializeDataset", () => {
  it("preserves campaign + defaults from seed", () => {
    const out = serializeDataset(SEED, []);
    expect(out.campaign.id).toBe("test-camp");
    expect(out.campaign.platform).toBe("NAVER_GFA");
    expect(out.defaults.brandName).toBe("X");
    expect(out.variants).toEqual([]);
  });

  it("strips blob: image src on export (non-portable URL)", () => {
    const out = serializeDataset(SEED, [
      { ...baseVariant, image: { src: "blob:http://localhost/abc", alt: "u" } },
    ]);
    expect(out.variants[0].image.src).toBe("");
    expect(out.variants[0].image.alt).toBe("u");
  });

  it("preserves http(s) and same-origin image src", () => {
    const out = serializeDataset(SEED, [
      { ...baseVariant, image: { src: "https://cdn/x.jpg", alt: "u" } },
      { ...baseVariant, id: "v2", image: { src: "/products/cyclist.svg", alt: "" } },
    ]);
    expect(out.variants[0].image.src).toBe("https://cdn/x.jpg");
    expect(out.variants[1].image.src).toBe("/products/cyclist.svg");
  });

  it("includes only headline/description/ctaText in copy (no brand leaks)", () => {
    const v = {
      ...baseVariant,
      copy: {
        headline: "h",
        description: "d",
        ctaText: "go",
        brandName: "should-not-leak",
        adLabel: "광고",
      },
    };
    const out = serializeDataset(SEED, [v]);
    expect(out.variants[0].copy).toEqual({
      headline: "h",
      description: "d",
      ctaText: "go",
    });
  });

  it("retains axis", () => {
    const out = serializeDataset(SEED, [baseVariant]);
    expect(out.variants[0].axis).toEqual({
      audience: "runner",
      tone: "performance",
    });
  });

  it("defaults missing copy/image fields to empty strings", () => {
    const v = { id: "v3", axis: {}, copy: {}, image: {} };
    const out = serializeDataset(SEED, [v]);
    expect(out.variants[0].copy).toEqual({
      headline: "",
      description: "",
      ctaText: "",
    });
    expect(out.variants[0].image).toEqual({ src: "", alt: "" });
  });
});
