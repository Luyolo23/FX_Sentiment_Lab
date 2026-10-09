import { describe, expect, it } from "vitest";
import { hitRate, pearson, priceChangeAt } from "@/lib/stats";

describe("stats", () => {
  it("pearson of perfectly correlated series is 1", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
  });
  it("hit rate counts direction matches, ignoring near-neutral days", () => {
    const h = hitRate([
      { date: "a", sentiment: 0.5, change: 0.1, count: 1 },
      { date: "b", sentiment: -0.5, change: 0.1, count: 1 },
      { date: "c", sentiment: 0.01, change: 0.1, count: 1 },
    ]);
    expect(h).toEqual({ rate: 0.5, hits: 1, n: 2 });
  });
  it("next-day lag uses the following trading day", () => {
    const prices = [
      { pair: "X", date: "2026-01-01", close: 100 },
      { pair: "X", date: "2026-01-02", close: 101 },
      { pair: "X", date: "2026-01-05", close: 102.01 },
    ];
    expect(priceChangeAt(prices, "2026-01-02", 1)).toBeCloseTo(1);
  });
});
