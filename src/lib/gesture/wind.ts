import type { WindVector, WaveGestureState } from "../types";
import {
  SCALED_MAX_GESTURE_WIND,
  SCALED_MAX_GESTURE_WIND_DELTA,
  SCALED_GESTURE_WAVE_TO_WIND,
  SCALED_OPEN_PALM_POSE_BIAS,
  SCALED_MAX_GESTURE_VERTICAL_WIND,
  SCALED_MAX_GESTURE_VERTICAL_WIND_DELTA,
  SCALED_OPEN_PALM_POSE_BIAS_Y,
  SCALED_MAX_GESTURE_DEPTH_WIND,
  SCALED_MAX_GESTURE_DEPTH_WIND_DELTA,
  SCALED_OPEN_PALM_POSE_BIAS_Z,
} from "../constants";

export function updateWindFromWave(
  wristX: number,
  wristY: number,
  wristZ: number,
  canvasWidth: number,
  canvasHeight: number,
  waveState: WaveGestureState,
  windTarget: WindVector,
  now: number
): void {
  if (!waveState.active) {
    waveState.active = true;
    waveState.lastX = wristX;
    waveState.lastY = wristY;
    waveState.lastZ = wristZ;
    waveState.lastTime = now;
    return;
  }

  const deltaX = wristX - waveState.lastX;
  const deltaY = wristY - waveState.lastY;
  const deltaZ = wristZ - waveState.lastZ;
  const deltaTime = (now - waveState.lastTime) / 1000;

  if (deltaTime > 0) {
    const speedX = deltaX / deltaTime;
    const speedY = deltaY / deltaTime;
    const speedZ = deltaZ / deltaTime;

    const windDeltaX =
      Math.sign(speedX) *
      Math.min(
        SCALED_MAX_GESTURE_WIND_DELTA,
        Math.abs(speedX) * SCALED_GESTURE_WAVE_TO_WIND
      );
    const windDeltaY =
      -Math.sign(speedY) *
      Math.min(
        SCALED_MAX_GESTURE_VERTICAL_WIND_DELTA,
        Math.abs(speedY) * SCALED_GESTURE_WAVE_TO_WIND
      );
    const windDeltaZ =
      -Math.sign(speedZ) *
      Math.min(
        SCALED_MAX_GESTURE_DEPTH_WIND_DELTA,
        Math.abs(speedZ) * SCALED_GESTURE_WAVE_TO_WIND
      );

    windTarget.x = Math.max(
      -SCALED_MAX_GESTURE_WIND,
      Math.min(SCALED_MAX_GESTURE_WIND, windTarget.x + windDeltaX)
    );
    windTarget.y = Math.max(
      -SCALED_MAX_GESTURE_VERTICAL_WIND,
      Math.min(SCALED_MAX_GESTURE_VERTICAL_WIND, windTarget.y + windDeltaY)
    );
    windTarget.z = Math.max(
      -SCALED_MAX_GESTURE_DEPTH_WIND,
      Math.min(SCALED_MAX_GESTURE_DEPTH_WIND, windTarget.z + windDeltaZ)
    );
  }

  waveState.lastX = wristX;
  waveState.lastY = wristY;
  waveState.lastZ = wristZ;
  waveState.lastTime = now;

  // Pose-based steady wind bias
  windTarget.x = Math.max(
    -SCALED_MAX_GESTURE_WIND,
    Math.min(
      SCALED_MAX_GESTURE_WIND,
      windTarget.x +
        ((wristX - canvasWidth / 2) / canvasWidth) * SCALED_OPEN_PALM_POSE_BIAS
    )
  );
  windTarget.y = Math.max(
    -SCALED_MAX_GESTURE_VERTICAL_WIND,
    Math.min(
      SCALED_MAX_GESTURE_VERTICAL_WIND,
      windTarget.y +
        ((canvasHeight / 2 - wristY) / canvasHeight) *
          SCALED_OPEN_PALM_POSE_BIAS_Y
    )
  );
  windTarget.z = Math.max(
    -SCALED_MAX_GESTURE_DEPTH_WIND,
    Math.min(
      SCALED_MAX_GESTURE_DEPTH_WIND,
      windTarget.z - wristZ * SCALED_OPEN_PALM_POSE_BIAS_Z
    )
  );
}
