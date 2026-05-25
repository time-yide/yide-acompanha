import { describe, it, expect } from "vitest";
import { normalizeUsername } from "@/lib/instagram-snapshots/scraper";

describe("normalizeUsername", () => {
  it("aceita username puro", () => {
    expect(normalizeUsername("yidedigital")).toBe("yidedigital");
  });
  it("remove @", () => {
    expect(normalizeUsername("@yidedigital")).toBe("yidedigital");
  });
  it("extrai de URL", () => {
    expect(normalizeUsername("https://instagram.com/yidedigital/")).toBe("yidedigital");
  });
  it("extrai de URL com query", () => {
    expect(normalizeUsername("https://www.instagram.com/yidedigital/?utm=1")).toBe("yidedigital");
  });
  it("retorna null para string vazia", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
  });
  it("retorna null para null/undefined", () => {
    expect(normalizeUsername(null)).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
  });
});
