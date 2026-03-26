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

let prevX = 0;
let prevY = 0;

type BalloonStroke = {
  id: number;
  points: THREE.Vector3[];
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  color: THREE.Color;
  velocityY: number;
  settled: boolean;
  bounce: number;
  baseRadius: number;
  minY: number;
  maxY: number;
};

export default function Home() {
  const [canvasSize, setCanvasSize] = useState([0, 0]);

  const videoRef = useRef<HTMLVideoElement>(null);
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

    const { minY, maxY } = computeBounds(stroke.points);
    stroke.minY = minY - radius;
    stroke.maxY = maxY + radius;
  };

  const clampInsideTank = (point: THREE.Vector3) => {
    const three = threeRef.current;
    if (!three) return;

    point.x = Math.min(three.rightWall - 10, Math.max(three.leftWall + 10, point.x));
    point.y = Math.min(three.topWall - 10, Math.max(three.bottomWall + 10, point.y));
    point.z = Math.min(three.frontWall - 25, Math.max(three.backWall + 25, point.z));
  };

  const addPointToActiveStroke = (x: number, y: number) => {
    const three = threeRef.current;
    if (!three) return;

    const state = balloonStateRef.current;
    const depth = state.tankDepth;
    const worldX = x - canvasSizeRef.current.width / 2;
    const worldY = canvasSizeRef.current.height / 2 - y;
    const wave = Math.sin(performance.now() / 220 + state.idSeed) * (depth * 0.22);
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      three.scene.add(mesh);

      const stroke: BalloonStroke = {
        id: ++state.idSeed,
        points: [point],
        mesh,
        color,
        velocityY: 0,
        settled: false,
        bounce: 1,
        baseRadius: 11 + Math.random() * 4,
        minY: point.y,
        maxY: point.y,
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

    if (smoothedPoint.distanceTo(last) < 3) {
      return;
    }

    stroke.points.push(smoothedPoint);
    rebuildBalloonGeometry(stroke, 1 + Math.sin(performance.now() / 70) * 0.04);
  };

  const releaseActiveStroke = () => {
    const state = balloonStateRef.current;
    const stroke = state.activeStroke;
    if (!stroke) return;

    if (stroke.points.length < MIN_POINTS_FOR_BALLOON) {
      threeRef.current?.scene.remove(stroke.mesh);
      stroke.mesh.geometry.dispose();
      stroke.mesh.material.dispose();
      state.strokes = state.strokes.filter((entry) => entry.id !== stroke.id);
    } else {
      stroke.velocityY = -40;
      stroke.bounce = 1;
      rebuildBalloonGeometry(stroke, 1.05);
    }

    state.activeStroke = null;
    prevX = 0;
    prevY = 0;
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
      const offsetY = stroke.velocityY * deltaSeconds;

      stroke.points.forEach((point) => {
        point.y += offsetY;
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

        if (Math.abs(stroke.velocityY) > 80 && stroke.bounce > 0.2) {
          stroke.velocityY = -stroke.velocityY * 0.35 * stroke.bounce;
          stroke.bounce *= FALL_DAMPING;
          rebuildBalloonGeometry(stroke, 0.9);
        } else {
          stroke.velocityY = 0;
          stroke.settled = true;
          rebuildBalloonGeometry(stroke, 1);
        }
      } else {
        rebuildBalloonGeometry(stroke, 1 + Math.min(Math.abs(stroke.velocityY) / 2000, 0.08));
      }
    });
  };

  const prepareThree = () => {
    const container = threeContainerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#041022");
    scene.fog = new THREE.Fog("#020712", 220, 2100);

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

    const ambient = new THREE.AmbientLight("#8cd4ff", 0.6);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#9fd8ff", 1.1);
    keyLight.position.set(220, 300, 500);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight("#ff6ef7", 1.2, 2600);
    rimLight.position.set(-260, 120, 420);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(window.innerWidth * 1.05, window.innerWidth * 1.05),
      new THREE.MeshStandardMaterial({ color: "#06213a", roughness: 0.95, metalness: 0.12 })
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
      new THREE.LineBasicMaterial({ color: "#66d9ff", transparent: true, opacity: 0.35 })
    );
    scene.add(tank);

    const driftParticles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: "#8ce6ff",
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
        new THREE.LineBasicMaterial({ color: "#66d9ff", transparent: true, opacity: 0.35 })
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

          if (!prevX && !prevY) {
            prevX = x;
            prevY = y;
          }

          const smoothedX = prevX + SMOOTHING_FACTOR * (x - prevX);
          const smoothedY = prevY + SMOOTHING_FACTOR * (y - prevY);
          addPointToActiveStroke(smoothedX, smoothedY);
          prevX = smoothedX;
          prevY = smoothedY;
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
        stroke.mesh.geometry.dispose();
        stroke.mesh.material.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <div className="flex flex-col items-center min-h-screen p-8 w-full justify-center bg-black overflow-hidden">
      <iframe
        src="https://ghbtns.com/github-btn.html?user=Cygra&repo=hand-gesture-whiteboard&type=star&count=true&size=large"
        width="170"
        height="30"
        title="GitHub"
        className="fixed top-2 left-2 z-50"
      />
      <div className="fixed top-2 underline text-white text-center z-40">
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
        style={{ transform: "rotateY(180deg)", opacity: 0.88 }}
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
        <ModalContent className="bg-[#10082c]">
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
