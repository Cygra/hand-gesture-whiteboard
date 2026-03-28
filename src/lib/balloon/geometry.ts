import * as THREE from "three";
import type { BalloonStroke, WallBounds } from "../types";
import {
  CONTACT_THRESHOLD_Y,
  MULTI_CONTACT_THRESHOLD,
  END_CAP_PROTRUSION,
  END_CAP_WIDTH_SEGMENTS,
  END_CAP_HEIGHT_SEGMENTS,
  WALL_PADDING_XY,
  WALL_PADDING_Z,
} from "../constants";

export function randomBalloonColor(): THREE.Color {
  const hue = Math.random();
  return new THREE.Color().setHSL(hue, 0.75, 0.55);
}

export function computeBounds(points: THREE.Vector3[]): {
  minY: number;
  maxY: number;
} {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  points.forEach((point) => {
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  });
  return { minY, maxY };
}

export function computeCenter(points: THREE.Vector3[]): THREE.Vector3 {
  const center = new THREE.Vector3();
  points.forEach((point) => center.add(point));
  return center.multiplyScalar(1 / points.length);
}

export function computeContactPivot(
  points: THREE.Vector3[],
  floorY: number
): THREE.Vector3 {
  let minY = Number.POSITIVE_INFINITY;
  points.forEach((point) => {
    if (point.y < minY) minY = point.y;
  });

  const pivot = new THREE.Vector3();
  let count = 0;
  points.forEach((point) => {
    if (point.y <= minY + CONTACT_THRESHOLD_Y) {
      pivot.x += point.x;
      pivot.z += point.z;
      count += 1;
    }
  });
  if (count === 0) {
    const center = points[Math.floor(points.length / 2)];
    return new THREE.Vector3(center.x, floorY, center.z);
  }

  return new THREE.Vector3(pivot.x / count, floorY, pivot.z / count);
}

export function alignMultiContactPoints(
  points: THREE.Vector3[],
  floorY: number
): void {
  let minY = Number.POSITIVE_INFINITY;
  points.forEach((point) => {
    if (point.y < minY) minY = point.y;
  });

  points.forEach((point) => {
    if (point.y <= minY + MULTI_CONTACT_THRESHOLD) {
      point.y = floorY;
    }
  });

  let correctedMinY = Number.POSITIVE_INFINITY;
  points.forEach((point) => {
    if (point.y < correctedMinY) correctedMinY = point.y;
  });
  if (correctedMinY < floorY) {
    const correction = floorY - correctedMinY;
    points.forEach((point) => {
      point.y += correction;
    });
  }
}

export function rebuildBalloonGeometry(
  stroke: BalloonStroke,
  elastic = 1
): void {
  if (stroke.points.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(stroke.points);
  const tubularSegments = Math.max(20, stroke.points.length * 3);
  const radialSegments = 14;
  const radius = stroke.baseRadius * elastic;
  const geometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    false
  );

  stroke.mesh.geometry.dispose();
  stroke.mesh.geometry = geometry;
  stroke.startCap.geometry.dispose();
  stroke.endCap.geometry.dispose();
  stroke.startCap.geometry = new THREE.SphereGeometry(
    radius * END_CAP_PROTRUSION,
    END_CAP_WIDTH_SEGMENTS,
    END_CAP_HEIGHT_SEGMENTS
  );
  stroke.endCap.geometry = new THREE.SphereGeometry(
    radius * END_CAP_PROTRUSION,
    END_CAP_WIDTH_SEGMENTS,
    END_CAP_HEIGHT_SEGMENTS
  );

  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  stroke.startCap.position.copy(start);
  stroke.endCap.position.copy(end);

  const { minY, maxY } = computeBounds(stroke.points);
  stroke.minY = minY - radius * END_CAP_PROTRUSION;
  stroke.maxY = maxY + radius * END_CAP_PROTRUSION;
}

export function clampInsideTank(
  point: THREE.Vector3,
  walls: WallBounds,
  clampY = true
): void {
  point.x = Math.min(
    walls.rightWall - WALL_PADDING_XY,
    Math.max(walls.leftWall + WALL_PADDING_XY, point.x)
  );
  if (clampY) {
    point.y = Math.min(
      walls.topWall - WALL_PADDING_XY,
      Math.max(walls.bottomWall + WALL_PADDING_XY, point.y)
    );
  }
  point.z = Math.min(
    walls.frontWall - WALL_PADDING_Z,
    Math.max(walls.backWall + WALL_PADDING_Z, point.z)
  );
}
