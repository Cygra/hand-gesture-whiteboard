import { PINCH_RATIO_THRESHOLD } from "../constants";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function isPinching(
  thumbTip: Point3D,
  indexTip: Point3D,
  wrist: Point3D,
  middleMcp: Point3D
): boolean {
  const palmSize = Math.sqrt(
    Math.pow(wrist.x - middleMcp.x, 2) + Math.pow(wrist.y - middleMcp.y, 2)
  );
  const pinchDist = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2) +
      Math.pow((thumbTip.z - indexTip.z) * 0.5, 2)
  );
  return palmSize > 0 && pinchDist / palmSize < PINCH_RATIO_THRESHOLD;
}
