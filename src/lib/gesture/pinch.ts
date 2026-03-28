import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { PINCH_RATIO_THRESHOLD } from "../constants";

export function isPinching(
  thumbTip: NormalizedLandmark,
  indexTip: NormalizedLandmark,
  wrist: NormalizedLandmark,
  middleMcp: NormalizedLandmark
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
