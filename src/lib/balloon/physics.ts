import * as THREE from "three";
import type { BalloonState, ThreeState, WindVector } from "../types";
import {
  GRAVITY,
  AIR_DRAG,
  MAX_FALL_SPEED,
  SWAY_FREQUENCY,
  LATERAL_DAMPING,
  SETTLED_LATERAL_DAMPING,
  GROUND_RESTITUTION,
  QUICK_BOUNCE_DAMPING,
  COLLISION_PUSH_FORCE,
  TOPPLE_TORQUE_SCALE,
  TOPPLE_DAMPING,
  MAX_TOPPLE_ANGULAR_SPEED,
  MIN_TOPPLE_OFFSET,
  MIN_BOUNCE_FACTOR,
  MIN_ANGULAR_VELOCITY,
  TOPPLE_STOP_THRESHOLD,
  SETTLEMENT_VELOCITY_Y,
  SETTLEMENT_LATERAL_SPEED,
  SETTLEMENT_BOUNCE_THRESHOLD,
  BOUNCE_STOP_SPEED,
  MULTI_CONTACT_THRESHOLD,
  FALL_STRETCH_DIVISOR,
  MAX_FALL_STRETCH,
  WALL_PADDING_XY,
  WALL_PADDING_Z,
  WALL_RESTITUTION,
  RANDOM_COLLISION_VELOCITY,
  GLOBAL_WIND_DECAY,
  GESTURE_WIND_BLEND_RATE,
  COLLISION_SPACING_MULTIPLIER,
  COLLISION_WAKE_THRESHOLD,
  EXTERNAL_WAKE_SPEED,
  SETTLE_CONFIRM_FRAMES,
  ENDPOINT_CONTACT_SETTLE_THRESHOLD,
} from "../constants";
import {
  clampInsideTank,
  rebuildBalloonGeometry,
  computeContactPivot,
  computeCenter,
  alignMultiContactPoints,
} from "./geometry";

export function stepPhysics(
  deltaSeconds: number,
  balloonState: BalloonState,
  three: ThreeState,
  windState: WindVector,
  windTarget: WindVector,
  enableFall: boolean
): void {
  if (!enableFall) {
    balloonState.strokes.forEach((stroke) => {
      if (stroke === balloonState.activeStroke || stroke.points.length < 2)
        return;
      stroke.velocityX = 0;
      stroke.velocityY = 0;
      stroke.velocityZ = 0;
      stroke.angularVelocity = 0;
      stroke.toppling = false;
      stroke.settleFrames = 0;
      rebuildBalloonGeometry(stroke, 1);
    });
    return;
  }

  const settled = balloonState.strokes.filter((stroke) => stroke.settled);

  // Pair-wise lateral collision push
  for (let i = 0; i < balloonState.strokes.length; i++) {
    const strokeA = balloonState.strokes[i];
    if (strokeA === balloonState.activeStroke || strokeA.points.length < 2)
      continue;
    const centerA = strokeA.points[Math.floor(strokeA.points.length / 2)];
    if (!centerA) continue;

    for (let j = i + 1; j < balloonState.strokes.length; j++) {
      const strokeB = balloonState.strokes[j];
      if (strokeB === balloonState.activeStroke || strokeB.points.length < 2)
        continue;
      const centerB = strokeB.points[Math.floor(strokeB.points.length / 2)];
      if (!centerB) continue;

      const dx = centerA.x - centerB.x;
      const dz = centerA.z - centerB.z;
      const distanceXZ = Math.sqrt(dx * dx + dz * dz);
      const allowed =
        strokeA.baseRadius * COLLISION_SPACING_MULTIPLIER +
        strokeB.baseRadius * COLLISION_SPACING_MULTIPLIER;
      if (distanceXZ >= allowed) continue;

      if (distanceXZ > 0.001) {
        const push = ((allowed - distanceXZ) / allowed) * COLLISION_PUSH_FORCE;
        const pushX = (dx / distanceXZ) * push * deltaSeconds;
        const pushZ = (dz / distanceXZ) * push * deltaSeconds;
        strokeA.velocityX += pushX;
        strokeA.velocityZ += pushZ;
        strokeB.velocityX -= pushX;
        strokeB.velocityZ -= pushZ;
      } else {
        const randomX = (Math.random() - 0.5) * RANDOM_COLLISION_VELOCITY;
        const randomZ = (Math.random() - 0.5) * RANDOM_COLLISION_VELOCITY;
        strokeA.velocityX += randomX;
        strokeA.velocityZ += randomZ;
        strokeB.velocityX -= randomX;
        strokeB.velocityZ -= randomZ;
      }

      if (strokeA.settled) {
        const pushSpeedA = Math.hypot(strokeA.velocityX, strokeA.velocityZ);
        if (pushSpeedA > COLLISION_WAKE_THRESHOLD) {
          strokeA.settled = false;
          strokeA.settleFrames = 0;
        }
      }
      if (strokeB.settled) {
        const pushSpeedB = Math.hypot(strokeB.velocityX, strokeB.velocityZ);
        if (pushSpeedB > COLLISION_WAKE_THRESHOLD) {
          strokeB.settled = false;
          strokeB.settleFrames = 0;
        }
      }
    }
  }

  // Wind decay and blend
  windTarget.x -= windTarget.x * GLOBAL_WIND_DECAY * deltaSeconds;
  windTarget.y -= windTarget.y * GLOBAL_WIND_DECAY * deltaSeconds;
  windTarget.z -= windTarget.z * GLOBAL_WIND_DECAY * deltaSeconds;
  const windBlend = Math.min(1, GESTURE_WIND_BLEND_RATE * deltaSeconds);
  windState.x += (windTarget.x - windState.x) * windBlend;
  windState.y += (windTarget.y - windState.y) * windBlend;
  windState.z += (windTarget.z - windState.z) * windBlend;

  balloonState.strokes.forEach((stroke) => {
    if (stroke === balloonState.activeStroke || stroke.points.length < 2) {
      return;
    }

    if (stroke.settled) {
      const windSpeed = Math.hypot(windState.x, windState.y, windState.z);
      const collisionSpeed = Math.hypot(stroke.velocityX, stroke.velocityZ);
      if (windSpeed + collisionSpeed > EXTERNAL_WAKE_SPEED) {
        stroke.settled = false;
        stroke.settleFrames = 0;
      }
    }

    if (!stroke.settled) {
      stroke.velocityY -= GRAVITY * deltaSeconds;
      stroke.velocityY -= stroke.velocityY * AIR_DRAG * deltaSeconds;
      if (stroke.velocityY < -MAX_FALL_SPEED) {
        stroke.velocityY = -MAX_FALL_SPEED;
      }
    }

    if (!stroke.settled) {
      const swayTime =
        performance.now() * 0.001 * SWAY_FREQUENCY + stroke.swayPhase;
      stroke.velocityX +=
        Math.sin(swayTime) * stroke.swayStrength * deltaSeconds;
      stroke.velocityZ +=
        Math.cos(swayTime * 0.9 + stroke.swayPhase) *
        stroke.swayStrength *
        0.65 *
        deltaSeconds;
    }

    stroke.velocityX += windState.x * deltaSeconds;
    stroke.velocityY += windState.y * deltaSeconds;
    stroke.velocityZ += windState.z * deltaSeconds;

    const lateralDamping = stroke.settled
      ? SETTLED_LATERAL_DAMPING
      : LATERAL_DAMPING;
    stroke.velocityX -= stroke.velocityX * lateralDamping * deltaSeconds;
    stroke.velocityZ -= stroke.velocityZ * lateralDamping * deltaSeconds;

    const offsetY = stroke.settled ? 0 : stroke.velocityY * deltaSeconds;
    const offsetX = stroke.velocityX * deltaSeconds;
    const offsetZ = stroke.velocityZ * deltaSeconds;

    stroke.points.forEach((point) => {
      point.x += offsetX;
      point.y += offsetY;
      point.z += offsetZ;
      clampInsideTank(point, three, false);
    });

    const leftLimit = three.leftWall + WALL_PADDING_XY;
    const rightLimit = three.rightWall - WALL_PADDING_XY;
    const topLimit = three.topWall - WALL_PADDING_XY;
    const hitLeftWall = stroke.points.some((p) => p.x <= leftLimit + 0.001);
    const hitRightWall = stroke.points.some((p) => p.x >= rightLimit - 0.001);
    const hitTopWall = stroke.points.some((p) => p.y >= topLimit - 0.001);
    const backLimit = three.backWall + WALL_PADDING_Z;
    const frontLimit = three.frontWall - WALL_PADDING_Z;
    const hitBackWall = stroke.points.some((p) => p.z <= backLimit + 0.001);
    const hitFrontWall = stroke.points.some((p) => p.z >= frontLimit - 0.001);

    if (hitLeftWall && stroke.velocityX < 0) {
      stroke.velocityX = -stroke.velocityX * WALL_RESTITUTION;
    } else if (hitRightWall && stroke.velocityX > 0) {
      stroke.velocityX = -stroke.velocityX * WALL_RESTITUTION;
    }
    if (hitTopWall && stroke.velocityY > 0) {
      stroke.velocityY = -stroke.velocityY * WALL_RESTITUTION;
    }
    if (hitBackWall && stroke.velocityZ < 0) {
      stroke.velocityZ = -stroke.velocityZ * WALL_RESTITUTION;
    } else if (hitFrontWall && stroke.velocityZ > 0) {
      stroke.velocityZ = -stroke.velocityZ * WALL_RESTITUTION;
    }

    let targetBottom = three.bottomWall + stroke.baseRadius;

    settled.forEach((other) => {
      if (other.id === stroke.id) return;
      const centerA = stroke.points[Math.floor(stroke.points.length / 2)];
      const centerB = other.points[Math.floor(other.points.length / 2)];
      if (!centerA || !centerB) return;

      const dx = centerA.x - centerB.x;
      const dz = centerA.z - centerB.z;
      const distanceXZ = Math.sqrt(dx * dx + dz * dz);
      const allowed =
        stroke.baseRadius * COLLISION_SPACING_MULTIPLIER +
        other.baseRadius * COLLISION_SPACING_MULTIPLIER;
      if (distanceXZ < allowed) {
        targetBottom = Math.max(targetBottom, other.maxY + stroke.baseRadius * 1.05);
      }
    });

    let currentBottom = Number.POSITIVE_INFINITY;
    stroke.points.forEach((point) => {
      if (point.y < currentBottom) currentBottom = point.y;
    });

    if (currentBottom <= targetBottom) {
      const correction = targetBottom - currentBottom;
      stroke.points.forEach((point) => {
        point.y += correction;
      });

      if (!stroke.landed) {
        stroke.landed = true;
        stroke.contactPivot = computeContactPivot(stroke.points, targetBottom);
        const center = computeCenter(stroke.points);
        const offset = new THREE.Vector3(
          center.x - stroke.contactPivot.x,
          0,
          center.z - stroke.contactPivot.z
        );
        const offsetLength = offset.length();
        if (offsetLength > MIN_TOPPLE_OFFSET) {
          offset.normalize();
          stroke.tiltAxis.set(offset.z, 0, -offset.x).normalize();
          stroke.angularVelocity = Math.min(
            MAX_TOPPLE_ANGULAR_SPEED,
            offsetLength * TOPPLE_TORQUE_SCALE
          );
          stroke.toppling = true;
        }
      }

      const incomingVelocity = -stroke.velocityY;
      if (incomingVelocity > 0) {
        const bouncedSpeed =
          incomingVelocity * GROUND_RESTITUTION * stroke.bounce;
        stroke.bounce *= QUICK_BOUNCE_DAMPING;
        if (bouncedSpeed > BOUNCE_STOP_SPEED && stroke.bounce > MIN_BOUNCE_FACTOR) {
          stroke.velocityY = bouncedSpeed;
          rebuildBalloonGeometry(stroke, 0.93);
        } else {
          stroke.velocityY = 0;
          stroke.bounce *= FALL_DAMPING;
        }
      }

      if (stroke.toppling && stroke.angularVelocity > MIN_ANGULAR_VELOCITY) {
        const angle = stroke.angularVelocity * deltaSeconds;
        stroke.points.forEach((point) => {
          point.sub(stroke.contactPivot);
          point.applyAxisAngle(stroke.tiltAxis, angle);
          point.add(stroke.contactPivot);
        });
        stroke.angularVelocity -= stroke.angularVelocity * TOPPLE_DAMPING * deltaSeconds;
        if (stroke.angularVelocity < TOPPLE_STOP_THRESHOLD) {
          stroke.angularVelocity = 0;
          stroke.toppling = false;
        }
      }

      const lateralSpeed = Math.sqrt(
        stroke.velocityX * stroke.velocityX +
          stroke.velocityZ * stroke.velocityZ
      );
      const startPoint = stroke.points[0];
      const endPoint = stroke.points[stroke.points.length - 1];
      const endpointsStable =
        Math.abs(startPoint.y - targetBottom) <
          ENDPOINT_CONTACT_SETTLE_THRESHOLD &&
        Math.abs(endPoint.y - targetBottom) < ENDPOINT_CONTACT_SETTLE_THRESHOLD;
      const multiContactCount = stroke.points.filter(
        (point) => point.y <= targetBottom + MULTI_CONTACT_THRESHOLD
      ).length;
      const hasMultiContact = multiContactCount > 1;

      if (
        Math.abs(stroke.velocityY) < SETTLEMENT_VELOCITY_Y &&
        lateralSpeed < SETTLEMENT_LATERAL_SPEED &&
        !stroke.toppling &&
        stroke.bounce < SETTLEMENT_BOUNCE_THRESHOLD &&
        endpointsStable &&
        hasMultiContact
      ) {
        stroke.settleFrames += 1;
      } else {
        stroke.settleFrames = 0;
      }

      if (stroke.settleFrames >= SETTLE_CONFIRM_FRAMES) {
        stroke.velocityY = 0;
        stroke.velocityX = 0;
        stroke.velocityZ = 0;
        alignMultiContactPoints(stroke.points, targetBottom);
        stroke.settled = true;
        stroke.settleFrames = 0;
      } else if (stroke.settled) {
        alignMultiContactPoints(stroke.points, targetBottom);
      }
      rebuildBalloonGeometry(stroke, 1);
    } else {
      rebuildBalloonGeometry(
        stroke,
        1 +
          Math.min(
            Math.abs(stroke.velocityY) / FALL_STRETCH_DIVISOR,
            MAX_FALL_STRETCH
          )
      );
    }
  });
}
