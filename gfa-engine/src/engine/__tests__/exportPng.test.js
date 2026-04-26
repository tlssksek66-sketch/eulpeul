import { describe, it, expect } from "vitest";
import { buildFilename } from "../exportPng.js";

describe("buildFilename", () => {
  it("joins campaign + variant with double underscore + .png", () => {
    expect(buildFilename("camp1", "var1")).toBe("camp1__var1.png");
  });

  it("sanitizes invalid filename chars (slash, space, hangul)", () => {
    expect(buildFilename("a/b c", "v 1")).toBe("a-b-c__v-1.png");
  });

  it("collapses runs of unsafe chars", () => {
    expect(buildFilename("a///b", "x")).toBe("a-b__x.png");
  });

  it("supports custom extension", () => {
    expect(buildFilename("c", "v", "jpg")).toBe("c__v.jpg");
    expect(buildFilename("c", "v", "zip")).toBe("c__v.zip");
  });

  it("preserves alphanumerics, dot, underscore, hyphen", () => {
    expect(buildFilename("a_b.c-1", "X-2_y.z")).toBe("a_b.c-1__X-2_y.z.png");
  });

  it("coerces non-string inputs", () => {
    expect(buildFilename(123, 456)).toBe("123__456.png");
  });
});
