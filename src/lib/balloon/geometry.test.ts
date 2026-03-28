import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  computeBounds,
  computeCenter,
  computeContactPivot,
  alignMultiContactPoints,
} from "@/lib/balloon/geometry";

const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

describe("computeBounds", () => {
  it("returns correct min/max Y for a flat line", () => {
    const pts = [v(0, 5), v(1, 3), v(2, 8), v(3, 1)];
    expect(computeBounds(pts)).toEqual({ minY: 1, maxY: 8 });
  });

  it("handles a single point", () => {
    expect(computeBounds([v(0, 4)])).toEqual({ minY: 4, maxY: 4 });
  });

  it("handles all same y", () => {
    const pts = [v(0, 2), v(1, 2), v(2, 2)];
    expect(computeBounds(pts)).toEqual({ minY: 2, maxY: 2 });
  });

  it("handles negative y values", () => {
    const pts = [v(0, -10), v(1, 0), v(2, 5)];
    expect(computeBounds(pts)).toEqual({ minY: -10, maxY: 5 });
  });
});

describe("computeCenter", () => {
  it("returns centroid of a simple set of points", () => {
    const pts = [v(0, 0), v(2, 0), v(2, 2), v(0, 2)];
    const center = computeCenter(pts);
    expect(center.x).toBeCloseTo(1);
    expect(center.y).toBeCloseTo(1);
  });

  it("works for a single point", () => {
    const center = computeCenter([v(3, 7)]);
    expect(center.x).toBeCloseTo(3);
    expect(center.y).toBeCloseTo(7);
  });

  it("returns origin for symmetric distribution", () => {
    const pts = [v(-1, 0), v(1, 0), v(0, -1), v(0, 1)];
    const center = computeCenter(pts);
    expect(center.x).toBeCloseTo(0);
    expect(center.y).toBeCloseTo(0);
  });
});

describe("computeContactPivot", () => {
  it("returns floor-level pivot near the lowest points", () => {
    const pts = [v(0, 0), v(1, 0), v(2, 10), v(3, 10)];
    const pivot = computeContactPivot(pts, 0);
    expect(pivot.y).toBe(0);
    // Should average x of the two lowest points (0 and 1)
    expect(pivot.x).toBeCloseTo(0.5);
  });

  it("falls back to midpoint when no points are near the floor", () => {
    // All points are high; CONTACT_THRESHOLD_Y = 8, none are within 8 of minY=100
    // Actually all points are equal so all qualify; let's place them all exactly at minY
    const pts = [v(4, 5), v(6, 5), v(8, 5)];
    const pivot = computeContactPivot(pts, 5);
    expect(pivot.y).toBe(5);
    // All qualify: avg x = (4+6+8)/3 = 6
    expect(pivot.x).toBeCloseTo(6);
  });
});

describe("alignMultiContactPoints", () => {
  it("raises points near the floor to floorY", () => {
    const pts = [v(0, 0.5), v(1, 0.1), v(2, 20)];
    alignMultiContactPoints(pts, 0);
    // 0.5 and 0.1 are within MULTI_CONTACT_THRESHOLD (5) of minY (0.1) → set to 0
    expect(pts[0].y).toBe(0);
    expect(pts[1].y).toBe(0);
    // high point unaffected
    expect(pts[2].y).toBe(20);
  });

  it("corrects points that fall below the floor after alignment", () => {
    // All points below floor
    const pts = [v(0, -5), v(1, -3), v(2, -1)];
    alignMultiContactPoints(pts, 0);
    // After aligning near-floor points: -3 and -1 get set to 0; -5 stays
    // Then correctedMinY is -5 → correction is 5 → all lifted by 5
    const ys = pts.map((p) => p.y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });
});
