import { approxPValue, buildDaily, buildValidation, hitRate, interpret, linreg, pearson } from "./stats";
import type { Dataset } from "./types";

export function computeValidation(data: Dataset, from: string, to: string, lag: number) {
  const daily = buildDaily(data, from, to);
  const points = buildValidation(daily, data.prices, lag);
  const xs = points.map((p) => p.sentiment);
  const ys = points.map((p) => p.change);
  const r = pearson(xs, ys);
  const p = r == null ? null : approxPValue(r, points.length);
  return {
    daily,
    points,
    r,
    p,
    hit: hitRate(points),
    reg: linreg(xs, ys),
    n: points.length,
    text: interpret(r, points.length, p),
  };
}

export const LAGS = [
  { v: 0, label: "Same day" },
  { v: 1, label: "Next day" },
  { v: 2, label: "2 days ahead" },
];
