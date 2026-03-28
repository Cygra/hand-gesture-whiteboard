import * as THREE from "three";

export type HoldActionType = "clear" | "theme";
export type Locale = "en" | "zh" | "ja";
export type ThemeMode = "light" | "dark";

export type BalloonStroke = {
  id: number;
  points: THREE.Vector3[];
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  startCap: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  endCap: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  color: THREE.Color;
  velocityY: number;
  settled: boolean;
  bounce: number;
  baseRadius: number;
  minY: number;
  maxY: number;
  velocityX: number;
  velocityZ: number;
  swayPhase: number;
  swayStrength: number;
  angularVelocity: number;
  tiltAxis: THREE.Vector3;
  contactPivot: THREE.Vector3;
  landed: boolean;
  toppling: boolean;
  settleFrames: number;
};

export type BalloonState = {
  strokes: BalloonStroke[];
  activeStroke: BalloonStroke | null;
  idSeed: number;
  tankDepth: number;
};

export type WindVector = { x: number; y: number; z: number };

export type WallBounds = {
  leftWall: number;
  rightWall: number;
  topWall: number;
  bottomWall: number;
  backWall: number;
  frontWall: number;
};

export type ThreeState = WallBounds & {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  tank: THREE.LineSegments;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  driftParticles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  animationFrame: number;
};

export type WaveGestureState = {
  active: boolean;
  lastX: number;
  lastY: number;
  lastZ: number;
  lastTime: number;
};

export type HoldState = {
  action: HoldActionType | null;
  token: number;
  startedAt: number;
  pendingLostAt: number | null;
  lastShownSecond: number;
  rearmBlockedAction: HoldActionType | null;
};

export type PinchReleaseState = { lostAt: number | null };
export type DrawPoint = { x: number; y: number };
