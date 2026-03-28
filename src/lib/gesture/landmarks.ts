import { GestureRecognizer, DrawingUtils } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export function drawLandmarks(
  landmarks: NormalizedLandmark[],
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  connected: boolean
): void {
  const drawingUtils = new DrawingUtils(ctx);
  ctx.clearRect(0, 0, width, height);
  drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
    color: "#00FFAA",
    lineWidth: connected ? 5 : 2,
  });
  drawingUtils.drawLandmarks(landmarks, {
    color: "#FF7AF0",
    lineWidth: 1,
  });
}
