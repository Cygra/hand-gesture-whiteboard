import { describe, it, expect } from "vitest";
import { isPinching } from "@/lib/gesture/pinch";
import { PINCH_RATIO_THRESHOLD } from "@/lib/constants";

const lm = (x: number, y: number, z = 0) => ({ x, y, z });

describe("isPinching", () => {
  it("returns true when thumb and index are close relative to palm size", () => {
    const wrist = lm(0, 0);
    const middleMcp = lm(0, 0.2); // palmSize ≈ 0.2
    const thumbTip = lm(0.5, 0.5);
    const indexTip = lm(0.5, 0.52); // dist ≈ 0.02, ratio ≈ 0.1 → pinching
    expect(isPinching(thumbTip, indexTip, wrist, middleMcp)).toBe(true);
  });

  it("returns false when fingers are far apart", () => {
    const wrist = lm(0, 0);
    const middleMcp = lm(0, 0.2); // palmSize ≈ 0.2
    const thumbTip = lm(0.1, 0.5);
    const indexTip = lm(0.9, 0.5); // dist ≈ 0.8, ratio ≈ 4 → not pinching
    expect(isPinching(thumbTip, indexTip, wrist, middleMcp)).toBe(false);
  });

  it("returns false when palmSize is 0 (degenerate)", () => {
    const wrist = lm(0.5, 0.5);
    const middleMcp = lm(0.5, 0.5); // palmSize = 0
    const thumbTip = lm(0.5, 0.5);
    const indexTip = lm(0.5, 0.5);
    expect(isPinching(thumbTip, indexTip, wrist, middleMcp)).toBe(false);
  });

  it("returns true exactly at the threshold boundary (just under)", () => {
    const wrist = lm(0, 0);
    const middleMcp = lm(0, 1); // palmSize = 1
    const thumbTip = lm(0, 0);
    // dist = PINCH_RATIO_THRESHOLD - epsilon → pinching
    const d = PINCH_RATIO_THRESHOLD * 0.99;
    const indexTip = lm(d, 0);
    expect(isPinching(thumbTip, indexTip, wrist, middleMcp)).toBe(true);
  });

  it("returns false exactly at the threshold boundary (just over)", () => {
    const wrist = lm(0, 0);
    const middleMcp = lm(0, 1); // palmSize = 1
    const thumbTip = lm(0, 0);
    const d = PINCH_RATIO_THRESHOLD * 1.01;
    const indexTip = lm(d, 0);
    expect(isPinching(thumbTip, indexTip, wrist, middleMcp)).toBe(false);
  });
});
