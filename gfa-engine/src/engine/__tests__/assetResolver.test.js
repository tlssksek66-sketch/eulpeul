import { describe, it, expect } from "vitest";
import {
  resolveAssetByAxis,
  resolveAltByAxis,
  resolveVariantImage,
  listAxisAssets,
} from "../assetResolver.js";

describe("resolveAssetByAxis", () => {
  it("returns SVG path for known audience", () => {
    expect(resolveAssetByAxis({ audience: "runner" })).toBe("/products/runner.svg");
    expect(resolveAssetByAxis({ audience: "commuter" })).toBe("/products/commuter.svg");
    expect(resolveAssetByAxis({ audience: "cyclist" })).toBe("/products/cyclist.svg");
    expect(resolveAssetByAxis({ audience: "office" })).toBe("/products/office.svg");
  });

  it("returns empty for unknown audience", () => {
    expect(resolveAssetByAxis({ audience: "alien" })).toBe("");
  });

  it("returns empty for missing axis", () => {
    expect(resolveAssetByAxis(undefined)).toBe("");
    expect(resolveAssetByAxis({})).toBe("");
  });
});

describe("resolveAltByAxis", () => {
  it("returns Korean alt text per audience", () => {
    expect(resolveAltByAxis({ audience: "runner" })).toContain("러너");
    expect(resolveAltByAxis({ audience: "office" })).toContain("오피스");
  });

  it("returns generic fallback for unknown axis", () => {
    expect(resolveAltByAxis({ audience: "alien" })).toBe("Shokz 키비주얼");
  });
});

describe("resolveVariantImage", () => {
  it("fills empty src from axis", () => {
    const out = resolveVariantImage({ src: "" }, { audience: "cyclist" });
    expect(out.src).toBe("/products/cyclist.svg");
    expect(out.alt).toContain("사이클");
  });

  it("preserves explicit alt when filling src", () => {
    const out = resolveVariantImage(
      { src: "", alt: "내가 적은 alt" },
      { audience: "runner" }
    );
    expect(out.src).toBe("/products/runner.svg");
    expect(out.alt).toBe("내가 적은 alt");
  });

  it("preserves explicit src as-is (https)", () => {
    const input = { src: "https://cdn.example.com/x.jpg", alt: "custom" };
    const out = resolveVariantImage(input, { audience: "cyclist" });
    expect(out.src).toBe("https://cdn.example.com/x.jpg");
    expect(out.alt).toBe("custom");
  });

  it("preserves blob: ObjectURLs (uploaded files)", () => {
    const out = resolveVariantImage(
      { src: "blob:http://localhost/abc-123", alt: "u.jpg" },
      { audience: "runner" }
    );
    expect(out.src).toBe("blob:http://localhost/abc-123");
  });

  it("returns input unchanged when audience unknown and src empty", () => {
    const input = { src: "" };
    const out = resolveVariantImage(input, { audience: "alien" });
    expect(out.src).toBe("");
  });
});

describe("listAxisAssets", () => {
  it("returns 4 axis entries", () => {
    const list = listAxisAssets();
    expect(list).toHaveLength(4);
    expect(list.map((x) => x.audience).sort()).toEqual([
      "commuter",
      "cyclist",
      "office",
      "runner",
    ]);
    list.forEach((entry) => {
      expect(entry.src).toMatch(/^\/products\/.+\.svg$/);
      expect(entry.alt).toBeTruthy();
    });
  });
});
