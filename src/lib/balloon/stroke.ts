import * as THREE from "three";
import type { BalloonState, ThreeState, PinchReleaseState, DrawPoint } from "../types";
import {
  SMOOTHING_FACTOR,
  MIN_POINTS_FOR_BALLOON,
  MIN_POINT_DISTANCE,
  WAVE_PERIOD,
  WAVE_DEPTH_RATIO,
  DRAWING_ANIMATION_PERIOD,
  DRAWING_ANIMATION_AMPLITUDE,
  END_CAP_PROTRUSION,
  END_CAP_WIDTH_SEGMENTS,
  END_CAP_HEIGHT_SEGMENTS,
  SWAY_STRENGTH,
  BALLOON_DEFAULT_RADIUS,
  BALLOON_RADIUS_VARIANCE,
} from "../constants";
import {
  randomBalloonColor,
  rebuildBalloonGeometry,
  clampInsideTank,
} from "./geometry";

export function addPointToActiveStroke(
  x: number,
  y: number,
  three: ThreeState,
  canvasSize: { width: number; height: number },
  balloonState: BalloonState
): void {
  const depth = balloonState.tankDepth;
  const worldX = x - canvasSize.width / 2;
  const worldY = canvasSize.height / 2 - y;
  const wave =
    Math.sin(performance.now() / WAVE_PERIOD + balloonState.idSeed) *
    (depth * WAVE_DEPTH_RATIO);
  const worldZ = wave;

  const point = new THREE.Vector3(worldX, worldY, worldZ);
  clampInsideTank(point, three);

  if (!balloonState.activeStroke) {
    const color = randomBalloonColor();
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.2,
      metalness: 0.25,
      emissive: color.clone().multiplyScalar(0.08),
    });
    const starterCurve = new THREE.CatmullRomCurve3([
      point.clone(),
      point.clone().add(new THREE.Vector3(1, 1, 0)),
    ]);
    const starterGeometry = new THREE.TubeGeometry(starterCurve, 8, BALLOON_DEFAULT_RADIUS, 12, false);
    const mesh = new THREE.Mesh(starterGeometry, material);
    const startCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        BALLOON_DEFAULT_RADIUS * END_CAP_PROTRUSION,
        END_CAP_WIDTH_SEGMENTS,
        END_CAP_HEIGHT_SEGMENTS
      ),
      material
    );
    const endCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        BALLOON_DEFAULT_RADIUS * END_CAP_PROTRUSION,
        END_CAP_WIDTH_SEGMENTS,
        END_CAP_HEIGHT_SEGMENTS
      ),
      material
    );
    startCap.position.copy(point);
    endCap.position.copy(point);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    startCap.castShadow = true;
    startCap.receiveShadow = true;
    endCap.castShadow = true;
    endCap.receiveShadow = true;

    three.scene.add(mesh);
    three.scene.add(startCap);
    three.scene.add(endCap);

    balloonState.activeStroke = {
      id: ++balloonState.idSeed,
      points: [point],
      mesh,
      startCap,
      endCap,
      color,
      velocityY: 0,
      settled: false,
      bounce: 1,
      baseRadius: BALLOON_DEFAULT_RADIUS + Math.random() * BALLOON_RADIUS_VARIANCE,
      minY: point.y,
      maxY: point.y,
      velocityX: (Math.random() - 0.5) * 8,
      velocityZ: (Math.random() - 0.5) * 8,
      swayPhase: Math.random() * Math.PI * 2,
      swayStrength: SWAY_STRENGTH * (0.7 + Math.random() * 0.6),
      angularVelocity: 0,
      tiltAxis: new THREE.Vector3(1, 0, 0),
      contactPivot: new THREE.Vector3(point.x, point.y, point.z),
      landed: false,
      toppling: false,
      settleFrames: 0,
    };
    balloonState.strokes.push(balloonState.activeStroke);
    return;
  }

  const stroke = balloonState.activeStroke;
  const last = stroke.points[stroke.points.length - 1];
  const smoothedPoint = new THREE.Vector3(
    last.x + SMOOTHING_FACTOR * (point.x - last.x),
    last.y + SMOOTHING_FACTOR * (point.y - last.y),
    last.z + SMOOTHING_FACTOR * (point.z - last.z)
  );

  if (smoothedPoint.distanceTo(last) < MIN_POINT_DISTANCE) {
    return;
  }

  stroke.points.push(smoothedPoint);
  rebuildBalloonGeometry(
    stroke,
    1 +
      Math.sin(performance.now() / DRAWING_ANIMATION_PERIOD) *
        DRAWING_ANIMATION_AMPLITUDE
  );
}

export function releaseActiveStroke(
  balloonState: BalloonState,
  scene: THREE.Scene,
  pinchReleaseState: PinchReleaseState,
  previousDrawPoint: DrawPoint
): void {
  const stroke = balloonState.activeStroke;
  if (!stroke) return;

  if (stroke.points.length < MIN_POINTS_FOR_BALLOON) {
    scene.remove(stroke.mesh);
    scene.remove(stroke.startCap);
    scene.remove(stroke.endCap);
    stroke.mesh.geometry.dispose();
    stroke.startCap.geometry.dispose();
    stroke.endCap.geometry.dispose();
    stroke.mesh.material.dispose();
    balloonState.strokes = balloonState.strokes.filter(
      (entry) => entry.id !== stroke.id
    );
  } else {
    stroke.velocityY = -40;
    stroke.bounce = 1;
    stroke.landed = false;
    stroke.toppling = false;
    stroke.angularVelocity = 0;
    rebuildBalloonGeometry(stroke, 1);
  }

  balloonState.activeStroke = null;
  pinchReleaseState.lostAt = null;
  previousDrawPoint.x = 0;
  previousDrawPoint.y = 0;
}

export function clearAllStrokes(
  balloonState: BalloonState,
  scene: THREE.Scene,
  pinchReleaseState: PinchReleaseState,
  previousDrawPoint: DrawPoint
): void {
  releaseActiveStroke(balloonState, scene, pinchReleaseState, previousDrawPoint);
  balloonState.strokes.forEach((stroke) => {
    scene.remove(stroke.mesh);
    scene.remove(stroke.startCap);
    scene.remove(stroke.endCap);
    stroke.mesh.geometry.dispose();
    stroke.startCap.geometry.dispose();
    stroke.endCap.geometry.dispose();
    stroke.mesh.material.dispose();
  });
  balloonState.strokes = [];
}
