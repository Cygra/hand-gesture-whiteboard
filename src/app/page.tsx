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
const MIN_BOUNCE_VELOCITY = 22;
const MIN_BOUNCE_FACTOR = 0.2;
const MIN_ANGULAR_VELOCITY = 0.01;
const TOPPLE_STOP_THRESHOLD = 0.03;
const SETTLEMENT_VELOCITY_Y = 12;
const SETTLEMENT_LATERAL_SPEED = 8;
const SETTLEMENT_BOUNCE_THRESHOLD = 0.25;
const FALL_STRETCH_DIVISOR = 2000;
const MAX_FALL_STRETCH = 0.08;
const WALL_PADDING_XY = 10;
const WALL_PADDING_Z = 25;
const WAVE_PERIOD = 220;
const WAVE_DEPTH_RATIO = 0.22;
const END_CAP_PROTRUSION = 1.12;
const END_CAP_WIDTH_SEGMENTS = 20;
const END_CAP_HEIGHT_SEGMENTS = 16;
const RANDOM_COLLISION_VELOCITY = 6;

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
};

export default function Home() {
  const [canvasSize, setCanvasSize] = useState([0, 0]);

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
    animationFrame: number;
    leftWall: number;
    rightWall: number;
    topWall: number;
    bottomWall: number;
    backWall: number;
    frontWall: number;
  } | null>(null);

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

  const clampInsideTank = (point: THREE.Vector3) => {
    const three = threeRef.current;
    if (!three) return;

    point.x = Math.min(
      three.rightWall - WALL_PADDING_XY,
      Math.max(three.leftWall + WALL_PADDING_XY, point.x)
    );
    point.y = Math.min(
      three.topWall - WALL_PADDING_XY,
      Math.max(three.bottomWall + WALL_PADDING_XY, point.y)
    );
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
      rebuildBalloonGeometry(stroke, 1.05);
    }

    state.activeStroke = null;
    previousDrawPointRef.current.x = 0;
    previousDrawPointRef.current.y = 0;
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
    const settled = state.strokes.filter((stroke) => stroke.settled);

    state.strokes.forEach((stroke) => {
      if (stroke === state.activeStroke || stroke.settled || stroke.points.length < 2) {
        return;
      }

      stroke.velocityY -= GRAVITY * deltaSeconds;
      stroke.velocityY -= stroke.velocityY * AIR_DRAG * deltaSeconds;
      if (stroke.velocityY < -MAX_FALL_SPEED) {
        stroke.velocityY = -MAX_FALL_SPEED;
      }

      const swayTime = performance.now() * 0.001 * SWAY_FREQUENCY + stroke.swayPhase;
      stroke.velocityX +=
        Math.sin(swayTime) * stroke.swayStrength * deltaSeconds;
      stroke.velocityZ +=
        Math.cos(swayTime * 0.9 + stroke.swayPhase) * stroke.swayStrength * 0.65 * deltaSeconds;

      stroke.velocityX -= stroke.velocityX * LATERAL_DAMPING * deltaSeconds;
      stroke.velocityZ -= stroke.velocityZ * LATERAL_DAMPING * deltaSeconds;

      const offsetY = stroke.velocityY * deltaSeconds;
      const offsetX = stroke.velocityX * deltaSeconds;
      const offsetZ = stroke.velocityZ * deltaSeconds;

      stroke.points.forEach((point) => {
        point.x += offsetX;
        point.y += offsetY;
        point.z += offsetZ;
        clampInsideTank(point);
      });

      let targetBottom = three.bottomWall + stroke.baseRadius;

      settled.forEach((other) => {
        const centerA = stroke.points[Math.floor(stroke.points.length / 2)];
        const centerB = other.points[Math.floor(other.points.length / 2)];
        if (!centerA || !centerB) return;

        const dx = centerA.x - centerB.x;
        const dz = centerA.z - centerB.z;
        const distanceXZ = Math.sqrt(dx * dx + dz * dz);
        const allowed = stroke.baseRadius * 1.8 + other.baseRadius * 1.8;
        if (distanceXZ < allowed) {
          targetBottom = Math.max(targetBottom, other.maxY + stroke.baseRadius * 1.05);
          if (distanceXZ > 0.001) {
            const push = ((allowed - distanceXZ) / allowed) * COLLISION_PUSH_FORCE;
            stroke.velocityX += (dx / distanceXZ) * push * deltaSeconds;
            stroke.velocityZ += (dz / distanceXZ) * push * deltaSeconds;
          } else {
            stroke.velocityX += (Math.random() - 0.5) * RANDOM_COLLISION_VELOCITY;
            stroke.velocityZ += (Math.random() - 0.5) * RANDOM_COLLISION_VELOCITY;
          }
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

        if (
          Math.abs(stroke.velocityY) > MIN_BOUNCE_VELOCITY &&
          stroke.bounce > MIN_BOUNCE_FACTOR
        ) {
          stroke.velocityY = -stroke.velocityY * GROUND_RESTITUTION * stroke.bounce;
          stroke.bounce *= QUICK_BOUNCE_DAMPING;
          rebuildBalloonGeometry(stroke, 0.93);
        } else {
          stroke.velocityY = 0;
          stroke.bounce *= FALL_DAMPING;
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
        if (
          Math.abs(stroke.velocityY) < SETTLEMENT_VELOCITY_Y &&
          lateralSpeed < SETTLEMENT_LATERAL_SPEED &&
          !stroke.toppling &&
          stroke.bounce < SETTLEMENT_BOUNCE_THRESHOLD
        ) {
          stroke.velocityY = 0;
          stroke.velocityX = 0;
          stroke.velocityZ = 0;
          stroke.settled = true;
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#edf7ff");
    scene.fog = new THREE.Fog("#f5fbff", 300, 2300);

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

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(window.innerWidth * 1.05, window.innerWidth * 1.05),
      new THREE.MeshStandardMaterial({ color: "#d9ebfb", roughness: 0.92, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -window.innerHeight / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const tankDepth = Math.max(320, Math.min(window.innerWidth, window.innerHeight) * 0.62);
    balloonStateRef.current.tankDepth = tankDepth;

    const boxGeometry = new THREE.BoxGeometry(
      window.innerWidth,
      window.innerHeight,
      tankDepth
    );
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const tank = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: "#6ba7d8", transparent: true, opacity: 0.42 })
    );
    scene.add(tank);

    const driftParticles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: "#8bb8db",
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

      activeThree.scene.remove(activeThree.tank);
      activeThree.tank.geometry.dispose();
      activeThree.tank.material.dispose();

      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
      const tank = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: "#6ba7d8", transparent: true, opacity: 0.42 })
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
        releaseActiveStroke();
        requestAnimationFrame(renderLoop);
        return;
      }

      let isConnected = false;
      result.landmarks.forEach((landmarks) => {
        const thumbTip = landmarks[THUMB_TIP_INDEX];
        const indexFingerTip = landmarks[INDEX_FINGER_TIP_INDEX];

        const dx = Math.abs((thumbTip.x - indexFingerTip.x) * width);
        const dy = Math.abs((thumbTip.y - indexFingerTip.y) * height);
        isConnected = dx < 50 && dy < 50;

        if (isConnected) {
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

        drawLandmarks(landmarks, landmarkCanvasCtx, width, height, isConnected);
      });

      if (!isConnected) {
        releaseActiveStroke();
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

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <div className="flex flex-col items-center min-h-screen p-8 w-full justify-center bg-[#f4fbff] overflow-hidden">
      <iframe
        src="https://ghbtns.com/github-btn.html?user=Cygra&repo=hand-gesture-whiteboard&type=star&count=true&size=large"
        width="170"
        height="30"
        title="GitHub"
        className="fixed top-2 left-2 z-50"
      />
      <div className="fixed top-2 underline text-[#16334d] text-center z-40">
        {"Connect your index finger tip and thumb tip (like 👌) to create 3D balloons."}
        <br />
        {"连接食指和拇指的指尖（就像 👌），绘制 3D 长条气球。"}
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
        className="fixed right-0 bottom-0 w-80 z-30"
        style={{ transform: "rotateY(180deg)", opacity: 0.82 }}
      />

      <Button
        onPress={onOpen}
        className="fixed top-2 right-2 z-50"
        color="primary"
        variant="shadow"
      >
        About
      </Button>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent className="bg-[#f8fcff] text-[#17324a]">
          <ModalHeader className="flex flex-col gap-1">About</ModalHeader>
          <ModalBody>
            <p>
              基于 Next.js 和 Mediapipe tasks-vision Gesture Recognizer
              实现的手势白板。
              <br />
              通过摄像头实时画面识别手势，在 3D 鱼缸空间里绘制长条气球并自然下落堆积。
            </p>
            <p>
              A gesture whiteboard based on Next.js and Mediapipe tasks-vision
              Gesture Recognizer.
              <br />
              Recognize gestures through real-time camera images and draw long
              3D balloon strokes that naturally fall and stack.
            </p>
            <p>其他 Mediapipe + Next.js 项目：</p>
            <p>Other Mediapipe + Next.js projects:</p>
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
