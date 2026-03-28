"use client";

import { useEffect, useRef, useState } from "react";

import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@nextui-org/modal";
import { Button } from "@nextui-org/button";
import { Link } from "@nextui-org/link";
import * as THREE from "three";

const THUMB_TIP_INDEX = 4;
const INDEX_FINGER_TIP_INDEX = 8;
const SMOOTHING_FACTOR = 0.3;
const MIN_POINTS_FOR_BALLOON = 6;
const GRAVITY = 900;
const FALL_DAMPING = 0.9;
const MAX_FRAME_TIME_SECONDS = 0.033;
const AIR_DRAG = 3.6;
const MAX_FALL_SPEED = 180;
const SWAY_FREQUENCY = 1.3;
const SWAY_STRENGTH = 24;
const LATERAL_DAMPING = 3.2;
const SETTLED_LATERAL_DAMPING = 5.2;
const GROUND_RESTITUTION = 0.28;
const QUICK_BOUNCE_DAMPING = 0.45;
const COLLISION_PUSH_FORCE = 26;
const TOPPLE_TORQUE_SCALE = 0.006;
const TOPPLE_DAMPING = 2.8;
const MAX_TOPPLE_ANGULAR_SPEED = 1.4;
const CONTACT_THRESHOLD_Y = 8;
const MIN_POINT_DISTANCE = 3;
const DRAWING_ANIMATION_PERIOD = 70;
const DRAWING_ANIMATION_AMPLITUDE = 0.04;
const MIN_TOPPLE_OFFSET = 2;
const MIN_BOUNCE_FACTOR = 0.2;
const MIN_ANGULAR_VELOCITY = 0.01;
const TOPPLE_STOP_THRESHOLD = 0.03;
const SETTLEMENT_VELOCITY_Y = 12;
const SETTLEMENT_LATERAL_SPEED = 8;
const SETTLEMENT_BOUNCE_THRESHOLD = 0.25;
const BOUNCE_STOP_SPEED = 8;
const MULTI_CONTACT_THRESHOLD = 5;
const FALL_STRETCH_DIVISOR = 2000;
const MAX_FALL_STRETCH = 0.08;
const WALL_PADDING_XY = 10;
const WALL_PADDING_Z = 25;
const WAVE_PERIOD = 220;
const WAVE_DEPTH_RATIO = 0.22;
// Slightly larger spacing keeps settled balloons visually separated instead of intersecting.
const COLLISION_SPACING_MULTIPLIER = 2.2;
const END_CAP_PROTRUSION = 1.12;
const END_CAP_WIDTH_SEGMENTS = 20;
const END_CAP_HEIGHT_SEGMENTS = 16;
const RANDOM_COLLISION_VELOCITY = 6;
const GLOBAL_WIND_DECAY = 2.4;
const GESTURE_WIND_MULTIPLIER = 10;
const MAX_GESTURE_WIND = 360;
const GESTURE_WAVE_TO_WIND = 0.2;
const MAX_GESTURE_WIND_DELTA = 80;
const OPEN_PALM_POSE_BIAS = 10;
const PINCH_RELEASE_GRACE_MS = 300;
const SCALED_MAX_GESTURE_WIND = MAX_GESTURE_WIND * GESTURE_WIND_MULTIPLIER;
const SCALED_MAX_GESTURE_WIND_DELTA = MAX_GESTURE_WIND_DELTA * GESTURE_WIND_MULTIPLIER;
const SCALED_GESTURE_WAVE_TO_WIND = GESTURE_WAVE_TO_WIND * GESTURE_WIND_MULTIPLIER;
const SCALED_OPEN_PALM_POSE_BIAS = OPEN_PALM_POSE_BIAS * GESTURE_WIND_MULTIPLIER;
const SCALED_MAX_GESTURE_VERTICAL_WIND = SCALED_MAX_GESTURE_WIND * 0.35;
const SCALED_MAX_GESTURE_VERTICAL_WIND_DELTA = SCALED_MAX_GESTURE_WIND_DELTA * 0.35;
const SCALED_OPEN_PALM_POSE_BIAS_Y = SCALED_OPEN_PALM_POSE_BIAS * 0.35;
const SCALED_MAX_GESTURE_DEPTH_WIND = SCALED_MAX_GESTURE_WIND * 0.3;
const SCALED_MAX_GESTURE_DEPTH_WIND_DELTA = SCALED_MAX_GESTURE_WIND_DELTA * 0.3;
const SCALED_OPEN_PALM_POSE_BIAS_Z = SCALED_OPEN_PALM_POSE_BIAS * 0.3;
const GESTURE_WIND_BLEND_RATE = 7;
const EXTERNAL_WAKE_SPEED = 26;
const COLLISION_WAKE_SCALE = 0.45;
const WALL_RESTITUTION = 0.28;
// A settled balloon should wake up from weaker collision impulse than direct wind wake.
const COLLISION_WAKE_THRESHOLD = EXTERNAL_WAKE_SPEED * COLLISION_WAKE_SCALE;
const SETTLE_CONFIRM_FRAMES = 12;
const ENDPOINT_SETTLE_MULTIPLIER = 1.6;
const ENDPOINT_CONTACT_SETTLE_THRESHOLD = CONTACT_THRESHOLD_Y * ENDPOINT_SETTLE_MULTIPLIER;
const OPEN_PALM_GESTURES = ["Open_Palm", "OpenPalm"];
const FIST_GESTURES = ["Closed_Fist", "Fist"];
const THEME_TOGGLE_GESTURES = ["Victory", "Thumb_Up", "Thumbs_Up", "ThumbUp"];
const GESTURE_HOLD_CONFIRM_MS = 3000;
const GESTURE_HOLD_JITTER_GRACE_MS = 180;
const JITTER_GRACE_SECONDS_TEXT = (GESTURE_HOLD_JITTER_GRACE_MS / 1000).toFixed(2);

type HoldActionType = "clear" | "theme";
type Locale = "en" | "zh" | "ja";

type BalloonStroke = {
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

type ThemeMode = "light" | "dark";

const THEME_PALETTES: Record<
  ThemeMode,
  {
    appBg: string;
    text: string;
    sceneBackground: string;
    fog: string;
    floor: string;
    tank: string;
    particle: string;
    modalBg: string;
    modalText: string;
  }
> = {
  light: {
    appBg: "#f4fbff",
    text: "#16334d",
    sceneBackground: "#edf7ff",
    fog: "#f5fbff",
    floor: "#d9ebfb",
    tank: "#6ba7d8",
    particle: "#8bb8db",
    modalBg: "#f8fcff",
    modalText: "#17324a",
  },
  dark: {
    appBg: "#0a1016",
    text: "#d7e8f9",
    sceneBackground: "#0c141f",
    fog: "#122031",
    floor: "#1b2a3c",
    tank: "#5f8cb7",
    particle: "#7ea3c5",
    modalBg: "#101b28",
    modalText: "#d3e6fb",
  },
};

export default function Home() {
  const [canvasSize, setCanvasSize] = useState([0, 0]);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [enableBalloonFall, setEnableBalloonFall] = useState(true);
  const [enableGestureWind, setEnableGestureWind] = useState(true);
  const [locale, setLocale] = useState<Locale>("en");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [holdCountdown, setHoldCountdown] = useState<{
    action: HoldActionType;
    seconds: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previousDrawPointRef = useRef({ x: 0, y: 0 });
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<(() => void) | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  const balloonStateRef = useRef<{
    strokes: BalloonStroke[];
    activeStroke: BalloonStroke | null;
    idSeed: number;
    tankDepth: number;
  }>({
    strokes: [],
    activeStroke: null,
    idSeed: 0,
    tankDepth: 360,
  });

  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    tank: THREE.LineSegments;
    floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    driftParticles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    animationFrame: number;
    leftWall: number;
    rightWall: number;
    topWall: number;
    bottomWall: number;
    backWall: number;
    frontWall: number;
  } | null>(null);
  const waveGestureStateRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    lastZ: number;
    lastTime: number;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    lastZ: 0,
    lastTime: 0,
  });
  const windStateRef = useRef({ x: 0, y: 0, z: 0 });
  const windTargetRef = useRef({ x: 0, y: 0, z: 0 });
  const holdStateRef = useRef<{
    action: HoldActionType | null;
    token: number;
    startedAt: number;
    pendingLostAt: number | null;
    lastShownSecond: number;
    rearmBlockedAction: HoldActionType | null;
  }>({
    action: null,
    token: 0,
    startedAt: 0,
    pendingLostAt: null,
    lastShownSecond: 0,
    rearmBlockedAction: null,
  });
  const pinchReleaseStateRef = useRef<{ lostAt: number | null }>({
    lostAt: null,
  });
  const enableBalloonFallRef = useRef(enableBalloonFall);
  const enableGestureWindRef = useRef(enableGestureWind);

  const uiText =
    locale === "zh"
      ? {
          drawHint: "连接食指和拇指的指尖（就像 👌），绘制 3D 长条气球。",
          featureHint:
            "👌 捏合绘制气球 | 🖐️ 张开手掌挥动造风 | ✊ 持续 3 秒清空气球 | ✌️/👍 持续 3 秒切换主题。",
          jitterHint: `手势短暂抖动时，只要未持续变化超过约 ${JITTER_GRACE_SECONDS_TEXT} 秒，倒计时会继续。`,
          holdClear: "✊ 持续握拳 3 秒清空气球",
          holdTheme: "✌️/👍 持续 3 秒切换主题",
          themeButton: themeMode === "dark" ? "浅色" : "深色",
          fallOn: "气球飘动：开",
          fallOff: "气球飘动：关",
          windOn: "手势风吹：开",
          windOff: "手势风吹：关",
          about: "关于",
          aboutTitle: "关于",
          aboutDesc1:
            "基于 Next.js 和 Mediapipe tasks-vision Gesture Recognizer 实现的手势白板。",
          aboutDesc2: "通过摄像头实时画面识别手势，在 3D 鱼缸空间里绘制长条气球并自由飘动。",
          otherProjects: "其他 Mediapipe + Next.js 项目：",
          privacyNotice:
            "🔒 所有处理均在您的浏览器本地完成，摄像头画面不会被上传或共享。",
        }
      : locale === "ja"
      ? {
          drawHint: "人差し指と親指の先を合わせて（👌）3D バルーンを描こう。",
          featureHint:
            "👌 ピンチで描画 | 🖐️ 手のひらを振って風を起こす | ✊ 3 秒握りこぶしで全消去 | ✌️/👍 3 秒キープでテーマ切替。",
          jitterHint: `ジェスチャーが一瞬ぶれても、${JITTER_GRACE_SECONDS_TEXT} 秒以内ならカウントダウンは継続されます。`,
          holdClear: "✊ 握りこぶしを 3 秒キープで全消去",
          holdTheme: "✌️/👍 3 秒キープでテーマ切替",
          themeButton: themeMode === "dark" ? "ライト" : "ダーク",
          fallOn: "浮遊：オン",
          fallOff: "浮遊：オフ",
          windOn: "風：オン",
          windOff: "風：オフ",
          about: "概要",
          aboutTitle: "概要",
          aboutDesc1:
            "Next.js と Mediapipe tasks-vision Gesture Recognizer を使ったジェスチャーホワイトボード。",
          aboutDesc2:
            "カメラ映像でジェスチャーを認識し、3D 空間にバルーンストロークを描いて自由に漂わせます。",
          otherProjects: "その他の Mediapipe + Next.js プロジェクト：",
          privacyNotice:
            "🔒 すべての処理はブラウザ内でのみ行われます。カメラ映像がアップロード・共有されることはありません。",
        }
      : {
          drawHint: "Connect your index finger tip and thumb tip (like 👌) to create 3D balloons.",
          featureHint:
            "👌 pinch to draw balloons | 🖐️ open palm wave for wind | ✊ hold 3s to clear | ✌️/👍 hold 3s to toggle theme.",
          jitterHint: `If gesture briefly jitters, countdown keeps running unless it changes for ~${JITTER_GRACE_SECONDS_TEXT}s.`,
          holdClear: "✊ Hold fist 3s to clear",
          holdTheme: "✌️/👍 Hold Victory or Thumbs Up 3s to toggle theme",
          themeButton: themeMode === "dark" ? "Light" : "Dark",
          fallOn: "Balloon Float: ON",
          fallOff: "Balloon Float: OFF",
          windOn: "Gesture Wind: ON",
          windOff: "Gesture Wind: OFF",
          about: "About",
          aboutTitle: "About",
          aboutDesc1:
            "A gesture whiteboard based on Next.js and Mediapipe tasks-vision Gesture Recognizer.",
          aboutDesc2:
            "Recognize gestures through real-time camera images and draw long 3D balloon strokes that float freely.",
          otherProjects: "Other Mediapipe + Next.js projects:",
          privacyNotice:
            "🔒 All processing runs entirely in your browser — camera footage is never uploaded or shared.",
        };

  const LANG_OPTIONS: { value: Locale; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
    { value: "ja", label: "日本語" },
  ];
  const currentLangLabel = LANG_OPTIONS.find((o) => o.value === locale)?.label ?? "EN";

  const randomBalloonColor = () => {
    const hue = Math.random();
    return new THREE.Color().setHSL(hue, 0.75, 0.55);
  };

  const computeBounds = (points: THREE.Vector3[]) => {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    points.forEach((point) => {
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    });
    return { minY, maxY };
  };

  const computeCenter = (points: THREE.Vector3[]) => {
    const center = new THREE.Vector3();
    points.forEach((point) => center.add(point));
    return center.multiplyScalar(1 / points.length);
  };

  const computeContactPivot = (points: THREE.Vector3[], floorY: number) => {
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
  };

  const alignMultiContactPoints = (points: THREE.Vector3[], floorY: number) => {
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
  };

  const rebuildBalloonGeometry = (stroke: BalloonStroke, elastic = 1) => {
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
  };

  const clampInsideTank = (point: THREE.Vector3, clampY = true) => {
    const three = threeRef.current;
    if (!three) return;

    point.x = Math.min(
      three.rightWall - WALL_PADDING_XY,
      Math.max(three.leftWall + WALL_PADDING_XY, point.x)
    );
    if (clampY) {
      point.y = Math.min(
        three.topWall - WALL_PADDING_XY,
        Math.max(three.bottomWall + WALL_PADDING_XY, point.y)
      );
    }
    point.z = Math.min(
      three.frontWall - WALL_PADDING_Z,
      Math.max(three.backWall + WALL_PADDING_Z, point.z)
    );
  };

  const addPointToActiveStroke = (x: number, y: number) => {
    const three = threeRef.current;
    if (!three) return;

    const state = balloonStateRef.current;
    const depth = state.tankDepth;
    const worldX = x - canvasSizeRef.current.width / 2;
    const worldY = canvasSizeRef.current.height / 2 - y;
    const wave =
      Math.sin(performance.now() / WAVE_PERIOD + state.idSeed) *
      (depth * WAVE_DEPTH_RATIO);
    const worldZ = wave;

    const point = new THREE.Vector3(worldX, worldY, worldZ);
    clampInsideTank(point);

    if (!state.activeStroke) {
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
      const starterGeometry = new THREE.TubeGeometry(starterCurve, 8, 11, 12, false);
      const mesh = new THREE.Mesh(starterGeometry, material);
      const startCap = new THREE.Mesh(
        new THREE.SphereGeometry(
          11 * END_CAP_PROTRUSION,
          END_CAP_WIDTH_SEGMENTS,
          END_CAP_HEIGHT_SEGMENTS
        ),
        material
      );
      const endCap = new THREE.Mesh(
        new THREE.SphereGeometry(
          11 * END_CAP_PROTRUSION,
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

      const stroke: BalloonStroke = {
        id: ++state.idSeed,
        points: [point],
        mesh,
        startCap,
        endCap,
        color,
        velocityY: 0,
        settled: false,
        bounce: 1,
        baseRadius: 11 + Math.random() * 4,
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

      state.activeStroke = stroke;
      state.strokes.push(stroke);
      return;
    }

    const stroke = state.activeStroke;
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
      1 + Math.sin(performance.now() / DRAWING_ANIMATION_PERIOD) * DRAWING_ANIMATION_AMPLITUDE
    );
  };

  const releaseActiveStroke = () => {
    const state = balloonStateRef.current;
    const stroke = state.activeStroke;
    if (!stroke) return;

    if (stroke.points.length < MIN_POINTS_FOR_BALLOON) {
      threeRef.current?.scene.remove(stroke.mesh);
      threeRef.current?.scene.remove(stroke.startCap);
      threeRef.current?.scene.remove(stroke.endCap);
      stroke.mesh.geometry.dispose();
      stroke.startCap.geometry.dispose();
      stroke.endCap.geometry.dispose();
      stroke.mesh.material.dispose();
      state.strokes = state.strokes.filter((entry) => entry.id !== stroke.id);
    } else {
      stroke.velocityY = -40;
      stroke.bounce = 1;
      stroke.landed = false;
      stroke.toppling = false;
      stroke.angularVelocity = 0;
      rebuildBalloonGeometry(stroke, 1);
    }

    state.activeStroke = null;
    pinchReleaseStateRef.current.lostAt = null;
    previousDrawPointRef.current.x = 0;
    previousDrawPointRef.current.y = 0;
  };

  const clearAllStrokes = () => {
    const state = balloonStateRef.current;
    releaseActiveStroke();
    state.strokes.forEach((stroke) => {
      threeRef.current?.scene.remove(stroke.mesh);
      threeRef.current?.scene.remove(stroke.startCap);
      threeRef.current?.scene.remove(stroke.endCap);
      stroke.mesh.geometry.dispose();
      stroke.startCap.geometry.dispose();
      stroke.endCap.geometry.dispose();
      stroke.mesh.material.dispose();
    });
    state.strokes = [];
  };

  const clearHoldCountdown = () => {
    holdStateRef.current.action = null;
    holdStateRef.current.pendingLostAt = null;
    holdStateRef.current.lastShownSecond = 0;
    setHoldCountdown(null);
  };

  const updateHoldGesture = (
    action: HoldActionType,
    isDetected: boolean,
    nowMs: number,
    onConfirm: () => void
  ) => {
    const hold = holdStateRef.current;

    if (hold.rearmBlockedAction === action) {
      if (!isDetected) {
        hold.rearmBlockedAction = null;
      }
      return;
    }

    if (hold.action === action) {
      if (isDetected) {
        hold.pendingLostAt = null;
      } else if (!hold.pendingLostAt) {
        hold.pendingLostAt = nowMs;
      } else if (nowMs - hold.pendingLostAt > GESTURE_HOLD_JITTER_GRACE_MS) {
        clearHoldCountdown();
        return;
      }

      const elapsed = nowMs - hold.startedAt;
      const remainSeconds = Math.max(1, Math.ceil((GESTURE_HOLD_CONFIRM_MS - elapsed) / 1000));
      if (hold.lastShownSecond !== remainSeconds) {
        hold.lastShownSecond = remainSeconds;
        setHoldCountdown({ action, seconds: remainSeconds });
      }

      if (elapsed >= GESTURE_HOLD_CONFIRM_MS) {
        hold.rearmBlockedAction = action;
        clearHoldCountdown();
        onConfirm();
      }
      return;
    }

    if (!isDetected) {
      return;
    }

    clearHoldCountdown();
    hold.action = action;
    hold.token += 1;
    hold.startedAt = nowMs;
    hold.pendingLostAt = null;
    hold.lastShownSecond = 3;
    setHoldCountdown({ action, seconds: 3 });
  };

  const toggleThemeMode = () => {
    setThemeMode((previous) => (previous === "light" ? "dark" : "light"));
  };

  const drawLandmarks = (
    landmarks: NormalizedLandmark[],
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    connected: boolean
  ) => {
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
  };

  const stepPhysics = (deltaSeconds: number) => {
    const three = threeRef.current;
    if (!three) return;

    const state = balloonStateRef.current;
    if (!enableBalloonFallRef.current) {
      state.strokes.forEach((stroke) => {
        if (stroke === state.activeStroke || stroke.points.length < 2) return;
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

    const settled = state.strokes.filter((stroke) => stroke.settled);

    for (let i = 0; i < state.strokes.length; i++) {
      const strokeA = state.strokes[i];
      if (strokeA === state.activeStroke || strokeA.points.length < 2) continue;
      const centerA = strokeA.points[Math.floor(strokeA.points.length / 2)];
      if (!centerA) continue;

      for (let j = i + 1; j < state.strokes.length; j++) {
        const strokeB = state.strokes[j];
        if (strokeB === state.activeStroke || strokeB.points.length < 2) continue;
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

    windTargetRef.current.x -= windTargetRef.current.x * GLOBAL_WIND_DECAY * deltaSeconds;
    windTargetRef.current.y -= windTargetRef.current.y * GLOBAL_WIND_DECAY * deltaSeconds;
    windTargetRef.current.z -= windTargetRef.current.z * GLOBAL_WIND_DECAY * deltaSeconds;
    const windBlend = Math.min(1, GESTURE_WIND_BLEND_RATE * deltaSeconds);
    windStateRef.current.x += (windTargetRef.current.x - windStateRef.current.x) * windBlend;
    windStateRef.current.y += (windTargetRef.current.y - windStateRef.current.y) * windBlend;
    windStateRef.current.z += (windTargetRef.current.z - windStateRef.current.z) * windBlend;

    state.strokes.forEach((stroke) => {
      if (stroke === state.activeStroke || stroke.points.length < 2) {
        return;
      }

      if (stroke.settled) {
        const windSpeed = Math.hypot(
          windStateRef.current.x,
          windStateRef.current.y,
          windStateRef.current.z
        );
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
        const swayTime = performance.now() * 0.001 * SWAY_FREQUENCY + stroke.swayPhase;
        stroke.velocityX += Math.sin(swayTime) * stroke.swayStrength * deltaSeconds;
        stroke.velocityZ +=
          Math.cos(swayTime * 0.9 + stroke.swayPhase) * stroke.swayStrength * 0.65 * deltaSeconds;
      }

      stroke.velocityX += windStateRef.current.x * deltaSeconds;
      stroke.velocityY += windStateRef.current.y * deltaSeconds;
      stroke.velocityZ += windStateRef.current.z * deltaSeconds;

      const lateralDamping = stroke.settled ? SETTLED_LATERAL_DAMPING : LATERAL_DAMPING;
      stroke.velocityX -= stroke.velocityX * lateralDamping * deltaSeconds;
      stroke.velocityZ -= stroke.velocityZ * lateralDamping * deltaSeconds;

      const offsetY = stroke.settled ? 0 : stroke.velocityY * deltaSeconds;
      const offsetX = stroke.velocityX * deltaSeconds;
      const offsetZ = stroke.velocityZ * deltaSeconds;

      stroke.points.forEach((point) => {
        point.x += offsetX;
        point.y += offsetY;
        point.z += offsetZ;
        clampInsideTank(point, false);
      });

      const tank = threeRef.current;
      if (tank) {
        const leftLimit = tank.leftWall + WALL_PADDING_XY;
        const rightLimit = tank.rightWall - WALL_PADDING_XY;
        const topLimit = tank.topWall - WALL_PADDING_XY;
        const hitLeftWall = stroke.points.some((point) => point.x <= leftLimit + 0.001);
        const hitRightWall = stroke.points.some((point) => point.x >= rightLimit - 0.001);
        const hitTopWall = stroke.points.some((point) => point.y >= topLimit - 0.001);
        const backLimit = tank.backWall + WALL_PADDING_Z;
        const frontLimit = tank.frontWall - WALL_PADDING_Z;
        const hitBackWall = stroke.points.some((point) => point.z <= backLimit + 0.001);
        const hitFrontWall = stroke.points.some((point) => point.z >= frontLimit - 0.001);

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
        if (point.y < currentBottom) {
          currentBottom = point.y;
        }
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
          const incomingSpeed = incomingVelocity;
          const bouncedSpeed = incomingSpeed * GROUND_RESTITUTION * stroke.bounce;
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
          stroke.velocityX * stroke.velocityX + stroke.velocityZ * stroke.velocityZ
        );
        const startPoint = stroke.points[0];
        const endPoint = stroke.points[stroke.points.length - 1];
        const endpointsStable =
          Math.abs(startPoint.y - targetBottom) < ENDPOINT_CONTACT_SETTLE_THRESHOLD &&
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
          1 + Math.min(Math.abs(stroke.velocityY) / FALL_STRETCH_DIVISOR, MAX_FALL_STRETCH)
        );
      }
    });
  };

  const prepareThree = () => {
    const container = threeContainerRef.current;
    if (!container) return;

    const palette = THEME_PALETTES[themeMode];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.sceneBackground);
    scene.fog = new THREE.Fog(palette.fog, 300, 2300);

    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      1,
      5000
    );
    camera.position.set(0, 0, 1120);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 0.86);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#b8dcff", 1.08);
    keyLight.position.set(220, 300, 500);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight("#c58cff", 0.85, 2600);
    rimLight.position.set(-260, 120, 420);
    scene.add(rimLight);

    const tankDepth = Math.max(320, Math.min(window.innerWidth, window.innerHeight) * 0.62);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(window.innerWidth, tankDepth),
      new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.92, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -window.innerHeight / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    balloonStateRef.current.tankDepth = tankDepth;

    const boxGeometry = new THREE.BoxGeometry(
      window.innerWidth,
      window.innerHeight,
      tankDepth
    );
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const tank = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: palette.tank, transparent: true, opacity: 0.42 })
    );
    scene.add(tank);

    const driftParticles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: palette.particle,
        size: 2,
        transparent: true,
        opacity: 0.5,
      })
    );
    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * window.innerWidth;
      positions[i * 3 + 1] = (Math.random() - 0.5) * window.innerHeight;
      positions[i * 3 + 2] = (Math.random() - 0.5) * tankDepth;
    }
    driftParticles.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    scene.add(driftParticles);

    const three = {
      scene,
      camera,
      renderer,
      tank,
      floor,
      driftParticles,
      animationFrame: 0,
      leftWall: -window.innerWidth / 2,
      rightWall: window.innerWidth / 2,
      topWall: window.innerHeight / 2,
      bottomWall: -window.innerHeight / 2,
      backWall: -tankDepth / 2,
      frontWall: tankDepth / 2,
    };
    threeRef.current = three;

    let previous = performance.now();
    const animate = () => {
      if (!threeRef.current) return;
      const now = performance.now();
      const deltaSeconds = Math.min(
        (now - previous) / 1000,
        MAX_FRAME_TIME_SECONDS
      );
      previous = now;

      stepPhysics(deltaSeconds);

      const attrs = driftParticles.geometry.getAttribute("position");
      for (let i = 0; i < attrs.count; i++) {
        const y = attrs.getY(i) - deltaSeconds * 10;
        attrs.setY(i, y < three.bottomWall ? three.topWall : y);
      }
      attrs.needsUpdate = true;

      three.renderer.render(three.scene, three.camera);
      three.animationFrame = requestAnimationFrame(animate);
    };

    animate();

    resizeRef.current = () => {
      const activeThree = threeRef.current;
      if (!activeThree) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const depth = Math.max(320, Math.min(width, height) * 0.62);
      balloonStateRef.current.tankDepth = depth;

      activeThree.camera.aspect = width / height;
      activeThree.camera.updateProjectionMatrix();
      activeThree.renderer.setSize(width, height);

      activeThree.leftWall = -width / 2;
      activeThree.rightWall = width / 2;
      activeThree.topWall = height / 2;
      activeThree.bottomWall = -height / 2;
      activeThree.backWall = -depth / 2;
      activeThree.frontWall = depth / 2;
      activeThree.floor.position.y = activeThree.bottomWall;
      activeThree.floor.geometry.dispose();
      activeThree.floor.geometry = new THREE.PlaneGeometry(width, depth);

      activeThree.scene.remove(activeThree.tank);
      activeThree.tank.geometry.dispose();
      if (Array.isArray(activeThree.tank.material)) {
        activeThree.tank.material.forEach((material) => material.dispose());
      } else {
        activeThree.tank.material.dispose();
      }

      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
      const tank = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: THEME_PALETTES[themeMode].tank,
          transparent: true,
          opacity: 0.42,
        })
      );
      activeThree.scene.add(tank);
      activeThree.tank = tank;
    };
  };

  const prepareVideoStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener("loadeddata", () => {
        process();
      });
    }
  };

  const process = async () => {
    let lastWebcamTime = -1;
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
        delegate: "GPU",
      },
      numHands: 1,
      runningMode: "VIDEO",
    });

    const landmarkCanvas = landmarkCanvasRef.current;
    const landmarkCanvasCtx = landmarkCanvas?.getContext("2d");
    const video = videoRef.current;

    const renderLoop = () => {
      if (!video || !landmarkCanvas || !landmarkCanvasCtx) {
        return;
      }

      if (video.currentTime === lastWebcamTime) {
        requestAnimationFrame(renderLoop);
        return;
      }

      lastWebcamTime = video.currentTime;
      const result = gestureRecognizer.recognizeForVideo(
        video,
        video.currentTime * 1000
      );
      const width = landmarkCanvas.width;
      const height = landmarkCanvas.height;

      if (!result.landmarks || result.landmarks.length === 0) {
        landmarkCanvasCtx.clearRect(0, 0, width, height);
        const now = performance.now();
        if (balloonStateRef.current.activeStroke) {
          if (pinchReleaseStateRef.current.lostAt === null) {
            pinchReleaseStateRef.current.lostAt = now;
          } else if (now - pinchReleaseStateRef.current.lostAt > PINCH_RELEASE_GRACE_MS) {
            releaseActiveStroke();
          }
        }
        waveGestureStateRef.current.active = false;
        clearHoldCountdown();
        holdStateRef.current.rearmBlockedAction = null;
        requestAnimationFrame(renderLoop);
        return;
      }

      let isConnected = false;
      let openPalmDetected = false;
      let fistDetected = false;
      let themeGestureDetected = false;

      result.landmarks.forEach((landmarks, handIndex) => {
        const handGestures = result.gestures?.[handIndex] ?? [];
        const categories = handGestures.map((gesture) => gesture.categoryName);
        const hasOpenPalm = categories.some((category) => OPEN_PALM_GESTURES.includes(category));
        const hasFist = categories.some((category) => FIST_GESTURES.includes(category));
        const hasThemeToggleGesture = categories.some((category) =>
          THEME_TOGGLE_GESTURES.includes(category)
        );

        openPalmDetected = openPalmDetected || hasOpenPalm;
        fistDetected = fistDetected || hasFist;
        themeGestureDetected = themeGestureDetected || hasThemeToggleGesture;

        const thumbTip = landmarks[THUMB_TIP_INDEX];
        const indexFingerTip = landmarks[INDEX_FINGER_TIP_INDEX];

        const dx = Math.abs((thumbTip.x - indexFingerTip.x) * width);
        const dy = Math.abs((thumbTip.y - indexFingerTip.y) * height);
        const pinchConnected = dx < 50 && dy < 50;
        const canDrawFromPinch = pinchConnected && !hasFist;
        isConnected = isConnected || canDrawFromPinch;

        if (canDrawFromPinch) {
          const x = (1 - indexFingerTip.x) * width;
          const y = indexFingerTip.y * height;

          if (!previousDrawPointRef.current.x && !previousDrawPointRef.current.y) {
            previousDrawPointRef.current.x = x;
            previousDrawPointRef.current.y = y;
          }

          const smoothedX =
            previousDrawPointRef.current.x +
            SMOOTHING_FACTOR * (x - previousDrawPointRef.current.x);
          const smoothedY =
            previousDrawPointRef.current.y +
            SMOOTHING_FACTOR * (y - previousDrawPointRef.current.y);
          addPointToActiveStroke(smoothedX, smoothedY);
          previousDrawPointRef.current.x = smoothedX;
          previousDrawPointRef.current.y = smoothedY;
        }

        drawLandmarks(landmarks, landmarkCanvasCtx, width, height, canDrawFromPinch);
      });

      if (enableGestureWindRef.current && openPalmDetected) {
        const hand = result.landmarks[0];
        const wrist = hand?.[0];
        if (wrist) {
          // Mirror x to match the camera-flipped canvas so waving direction aligns with user perspective.
          const wristX = (1 - wrist.x) * width;
          const wristY = wrist.y * height;
          const wristZ = wrist.z;
          const now = performance.now();
          const waveState = waveGestureStateRef.current;
          if (!waveState.active) {
            waveState.active = true;
            waveState.lastX = wristX;
            waveState.lastY = wristY;
            waveState.lastZ = wristZ;
            waveState.lastTime = now;
          } else {
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
              windTargetRef.current.x = Math.max(
                -SCALED_MAX_GESTURE_WIND,
                Math.min(SCALED_MAX_GESTURE_WIND, windTargetRef.current.x + windDeltaX)
              );
              windTargetRef.current.y = Math.max(
                -SCALED_MAX_GESTURE_VERTICAL_WIND,
                Math.min(
                  SCALED_MAX_GESTURE_VERTICAL_WIND,
                  windTargetRef.current.y + windDeltaY
                )
              );
              windTargetRef.current.z = Math.max(
                -SCALED_MAX_GESTURE_DEPTH_WIND,
                Math.min(SCALED_MAX_GESTURE_DEPTH_WIND, windTargetRef.current.z + windDeltaZ)
              );
            }
            waveState.lastX = wristX;
            waveState.lastY = wristY;
            waveState.lastZ = wristZ;
            waveState.lastTime = now;
          }

          windTargetRef.current.x = Math.max(
            -SCALED_MAX_GESTURE_WIND,
            Math.min(
              SCALED_MAX_GESTURE_WIND,
              windTargetRef.current.x +
                ((wristX - width / 2) / width) * SCALED_OPEN_PALM_POSE_BIAS
            )
          );
          windTargetRef.current.y = Math.max(
            -SCALED_MAX_GESTURE_VERTICAL_WIND,
            Math.min(
              SCALED_MAX_GESTURE_VERTICAL_WIND,
              windTargetRef.current.y +
                ((height / 2 - wristY) / height) * SCALED_OPEN_PALM_POSE_BIAS_Y
            )
          );
          windTargetRef.current.z = Math.max(
            -SCALED_MAX_GESTURE_DEPTH_WIND,
            Math.min(
              SCALED_MAX_GESTURE_DEPTH_WIND,
              windTargetRef.current.z - wristZ * SCALED_OPEN_PALM_POSE_BIAS_Z
            )
          );
        }
      } else {
        waveGestureStateRef.current.active = false;
      }

      const nowMs = performance.now();
      updateHoldGesture("clear", fistDetected, nowMs, () => {
        clearAllStrokes();
      });
      updateHoldGesture("theme", themeGestureDetected, nowMs, () => {
        toggleThemeMode();
      });

      if (isConnected) {
        pinchReleaseStateRef.current.lostAt = null;
      } else if (balloonStateRef.current.activeStroke) {
        if (pinchReleaseStateRef.current.lostAt === null) {
          pinchReleaseStateRef.current.lostAt = nowMs;
        } else if (nowMs - pinchReleaseStateRef.current.lostAt > PINCH_RELEASE_GRACE_MS) {
          releaseActiveStroke();
        }
      }

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  useEffect(() => {
    const currentVideo = videoRef.current;
    const balloonState = balloonStateRef.current;

    prepareThree();
    prepareVideoStream();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvasSizeRef.current = { width, height };
      setCanvasSize([width, height]);
      resizeRef.current?.();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      releaseActiveStroke();

      const three = threeRef.current;
      if (three) {
        cancelAnimationFrame(three.animationFrame);
        three.renderer.dispose();
        if (three.renderer.domElement.parentNode) {
          three.renderer.domElement.parentNode.removeChild(three.renderer.domElement);
        }
      }

      const stream = currentVideo?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      clearHoldCountdown();
      balloonState.strokes.forEach((stroke) => {
        threeRef.current?.scene.remove(stroke.startCap);
        threeRef.current?.scene.remove(stroke.endCap);
        stroke.mesh.geometry.dispose();
        stroke.startCap.geometry.dispose();
        stroke.endCap.geometry.dispose();
        stroke.mesh.material.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    const three = threeRef.current;
    if (!three) return;

    const palette = THEME_PALETTES[themeMode];
    three.scene.background = new THREE.Color(palette.sceneBackground);
    three.scene.fog = new THREE.Fog(palette.fog, 300, 2300);
    three.floor.material.color.set(palette.floor);
    const tankMaterial = three.tank.material;
    if (Array.isArray(tankMaterial)) {
      tankMaterial.forEach((material) => {
        if ('color' in material) (material as THREE.MeshStandardMaterial).color.set(palette.tank);
      });
    } else if ('color' in tankMaterial) {
      (tankMaterial as THREE.MeshStandardMaterial).color.set(palette.tank);
    }
    three.driftParticles.material.color.set(palette.particle);
  }, [themeMode]);

  useEffect(() => {
    if (!enableGestureWind) {
      waveGestureStateRef.current.active = false;
      windTargetRef.current.x = 0;
      windTargetRef.current.y = 0;
      windTargetRef.current.z = 0;
      windStateRef.current.x = 0;
      windStateRef.current.y = 0;
      windStateRef.current.z = 0;
    }
  }, [enableGestureWind]);

  useEffect(() => {
    enableBalloonFallRef.current = enableBalloonFall;
  }, [enableBalloonFall]);

  useEffect(() => {
    enableGestureWindRef.current = enableGestureWind;
  }, [enableGestureWind]);

  useEffect(() => {
    const savedFall = window.localStorage.getItem("enableBalloonFall");
    const savedWind = window.localStorage.getItem("enableGestureWind");
    const fallEnabled = savedFall !== null ? savedFall === "true" : true;
    if (savedFall !== null) {
      setEnableBalloonFall(fallEnabled);
      enableBalloonFallRef.current = fallEnabled;
    }
    if (savedWind !== null) {
      const windEnabled = fallEnabled ? savedWind === "true" : false;
      setEnableGestureWind(windEnabled);
      enableGestureWindRef.current = windEnabled;
    }
  }, []);

  // When fall is disabled, force wind off too
  useEffect(() => {
    if (!enableBalloonFall) {
      setEnableGestureWind(false);
      enableGestureWindRef.current = false;
    }
  }, [enableBalloonFall]);

  useEffect(() => {
    window.localStorage.setItem("enableBalloonFall", String(enableBalloonFall));
  }, [enableBalloonFall]);

  useEffect(() => {
    window.localStorage.setItem("enableGestureWind", String(enableGestureWind));
  }, [enableGestureWind]);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <div
      className="flex flex-col items-center min-h-screen p-8 w-full justify-center overflow-hidden"
      style={{ backgroundColor: THEME_PALETTES[themeMode].appBg }}
    >
      <iframe
        src="https://ghbtns.com/github-btn.html?user=Cygra&repo=hand-gesture-whiteboard&type=star&count=true&size=large"
        width="170"
        height="30"
        title="GitHub"
        className="fixed top-2 left-2 z-50"
      />
      <div
        className="fixed top-2 left-0 right-0 underline text-center z-40 px-2 text-xs sm:text-sm"
        style={{ color: THEME_PALETTES[themeMode].text }}
      >
        {uiText.drawHint}
        <br />
        {uiText.featureHint}
        <span className="hidden sm:inline">
          <br />
          {uiText.jitterHint}
        </span>
      </div>

      <div ref={threeContainerRef} className="fixed inset-0 z-0" />

      <canvas
        ref={landmarkCanvasRef}
        className="fixed inset-0 z-20 pointer-events-none"
        width={canvasSize[0] || 640}
        height={canvasSize[1] || 480}
        style={{ transform: "rotateY(180deg)" }}
      />

      <video
        playsInline
        ref={videoRef}
        autoPlay
        muted
        className="fixed right-0 bottom-0 w-20 sm:w-48 md:w-80 z-30"
        style={{ transform: "rotateY(180deg)", opacity: 0.82 }}
      />

      {/* Top-right control panel */}
      <div className="fixed top-2 right-2 z-50 flex flex-col gap-2 items-end">
        {/* Row 1: About + Theme + Language */}
        <div className="flex flex-wrap gap-2 items-center justify-end">
          {/* Language dropdown */}
          <div className="relative">
            <Button
              onPress={() => setLangDropdownOpen((v) => !v)}
              variant="flat"
              size="sm"
              style={{
                backgroundColor: THEME_PALETTES[themeMode].modalBg,
                color: THEME_PALETTES[themeMode].text,
                border: `1px solid ${THEME_PALETTES[themeMode].tank}`,
              }}
            >
              {currentLangLabel} ▾
            </Button>
            {langDropdownOpen && (
              <div
                className="absolute right-0 mt-1 rounded-lg overflow-hidden shadow-lg min-w-[6rem]"
                style={{
                  backgroundColor: THEME_PALETTES[themeMode].modalBg,
                  border: `1px solid ${THEME_PALETTES[themeMode].tank}`,
                  zIndex: 100,
                }}
              >
                {LANG_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className="block w-full text-left px-4 py-2 text-sm hover:opacity-70 transition-opacity"
                    style={{
                      backgroundColor:
                        option.value === locale
                          ? THEME_PALETTES[themeMode].tank
                          : "transparent",
                      color: THEME_PALETTES[themeMode].text,
                    }}
                    onClick={() => {
                      setLocale(option.value);
                      setLangDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <Button
            onPress={toggleThemeMode}
            variant="shadow"
            size="sm"
            style={
              themeMode === "dark"
                ? undefined
                : {
                    backgroundColor: THEME_PALETTES.dark.appBg,
                    color: THEME_PALETTES.dark.text,
                  }
            }
            color={themeMode === "dark" ? "warning" : undefined}
          >
            {uiText.themeButton}
          </Button>

          {/* About */}
          <Button onPress={onOpen} color="primary" variant="shadow" size="sm">
            {uiText.about}
          </Button>
        </div>

        {/* Row 2: toggles */}
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Button
            onPress={() => setEnableBalloonFall((previous) => !previous)}
            color={enableBalloonFall ? "success" : "default"}
            variant="shadow"
            size="sm"
          >
            {enableBalloonFall ? uiText.fallOn : uiText.fallOff}
          </Button>

          <Button
            onPress={() => setEnableGestureWind((previous) => !previous)}
            color={enableGestureWind ? "success" : "default"}
            variant="shadow"
            size="sm"
            isDisabled={!enableBalloonFall}
          >
            {enableGestureWind ? uiText.windOn : uiText.windOff}
          </Button>
        </div>
      </div>

      <div
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 text-xs opacity-60 pointer-events-none max-w-[90vw] sm:max-w-none text-center px-2"
        style={{ color: THEME_PALETTES[themeMode].text }}
      >
        {uiText.privacyNotice}
      </div>

      {holdCountdown !== null && (
        <div
          className="fixed inset-0 z-45 flex items-center justify-center pointer-events-none"
          style={{ color: THEME_PALETTES[themeMode].text }}
        >
          <div
            className="rounded-xl px-6 py-4 text-center font-semibold text-2xl border"
            style={{
              backgroundColor: THEME_PALETTES[themeMode].modalBg,
              borderColor: THEME_PALETTES[themeMode].tank,
            }}
          >
            <div>
              {holdCountdown.action === "clear" ? uiText.holdClear : uiText.holdTheme}
            </div>
            <div className="text-4xl mt-1">{holdCountdown.seconds}</div>
          </div>
        </div>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent
          style={{
            backgroundColor: THEME_PALETTES[themeMode].modalBg,
            color: THEME_PALETTES[themeMode].modalText,
          }}
        >
          <ModalHeader className="flex flex-col gap-1">{uiText.aboutTitle}</ModalHeader>
          <ModalBody>
            <p>
              {uiText.aboutDesc1}
              <br />
              {uiText.aboutDesc2}
            </p>
            <p>{uiText.otherProjects}</p>
            <p>
              <Link href="https://cygra.github.io/danmaku-mask/">
                Danmaku Mask
              </Link>
            </p>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
