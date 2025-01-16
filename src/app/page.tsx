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

const THUMB_TIP_INDEX = 4;
const INDEX_FINGER_TIP_INDEX = 8;
const SMOOTHING_FACTOR = 0.3;
let prevX: number, prevY: number;

export default function Home() {
  const [canvasSize, setCanvasSize] = useState([0, 0]);

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

    const gestureRecognizer = await GestureRecognizer.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
          delegate: "GPU",
        },
        numHands: 1,
        runningMode: "VIDEO",
      }
    );

    const landmarkCanvas = landmarkCanvasRef.current;
    const landmarkCanvasCtx = landmarkCanvas?.getContext("2d");
    const strokeCanvas = strokeCanvasRef.current;
    const strokeCanvasCtx = strokeCanvas?.getContext("2d");
    const video = videoRef.current!;

    const renderLoop = () => {
      if (!video || !landmarkCanvas || !landmarkCanvasCtx || !strokeCanvasCtx) {
        return;
      }

      if (video.currentTime === lastWebcamTime) {
        requestAnimationFrame(renderLoop);
        return;
      }

      lastWebcamTime = video.currentTime;
      const startTimeMs = performance.now();
      const result = gestureRecognizer.recognizeForVideo(video, startTimeMs);

      if (result.landmarks) {
        const width = landmarkCanvas.width;
        const height = landmarkCanvas.height;
        if (result.landmarks.length === 0) {
          landmarkCanvasCtx.clearRect(0, 0, width, height);
        } else {
          result.landmarks.forEach((landmarks) => {
            const thumbTip = landmarks[THUMB_TIP_INDEX];
            const indexFingerTip = landmarks[INDEX_FINGER_TIP_INDEX];

            const dx = (thumbTip.x - indexFingerTip.x) * width;
            const dy = (thumbTip.y - indexFingerTip.y) * height;

            const connected = dx < 50 && dy < 50;
            if (connected) {
              const x = (1 - indexFingerTip.x) * width;
              const y = indexFingerTip.y * height;
              drawLine(strokeCanvasCtx, x, y);
            } else {
              prevX = prevY = 0;
            }
            drawLandmarks(
              landmarks,
              landmarkCanvasCtx,
              width,
              height,
              connected
            );
          });
        }
      }
      requestAnimationFrame(() => {
        renderLoop();
      });
    };

    renderLoop();
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
      color: "#00FF00",
      lineWidth: connected ? 5 : 2,
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: "#FF0000",
      lineWidth: 1,
    });
  };

  const drawLine = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    if (!prevX || !prevY) {
      prevX = x;
      prevY = y;
    }

    const smoothedX = prevX + SMOOTHING_FACTOR * (x - prevX);
    const smoothedY = prevY + SMOOTHING_FACTOR * (y - prevY);
    ctx.lineWidth = 5;
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(smoothedX, smoothedY);
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.save();

    prevX = smoothedX;
    prevY = smoothedY;
  };

  useEffect(() => {
    prepareVideoStream();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setCanvasSize([window.innerWidth, window.innerHeight]);
    };
    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <div className="flex flex-col items-center min-h-screen p-8 w-full justify-center bg-gradient-to-tr from-black to-[#10182f]">
      <iframe
        src="https://ghbtns.com/github-btn.html?user=Cygra&repo=hand-gesture-whiteboard&type=star&count=true&size=large"
        width="170"
        height="30"
        title="GitHub"
        className={"fixed top-2 left-2 z-50"}
      />
      <div className={"fixed top-2 underline text-white text-center"}>
        {"Connect your index finger tip and thumb tip (like 👌) to draw."}
        <br />
        {"连接食指和拇指的指尖（就像 👌），开始画图。"}
      </div>
      <canvas
        ref={landmarkCanvasRef}
        className={"fixed inset-0 z-10"}
        width={canvasSize[0] || 640}
        height={canvasSize[1] || 480}
        style={{
          transform: "rotateY(180deg)",
        }}
      />
      <canvas
        ref={strokeCanvasRef}
        className={"fixed inset-0 z-10"}
        width={canvasSize[0] || 640}
        height={canvasSize[1] || 480}
      />
      <video
        playsInline
        ref={videoRef}
        autoPlay
        muted
        className={"fixed right-0 bottom-0 w-80"}
        style={{
          transform: "rotateY(180deg)",
        }}
      />
      <Button
        onPress={onOpen}
        className={"fixed top-2 right-2 z-50"}
        color="primary"
        variant="shadow"
      >
        About
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent className={"bg-[#10082c]"}>
          <ModalHeader className="flex flex-col gap-1">About</ModalHeader>
          <ModalBody>
            <p>
              基于 Next.js 和 Mediapipe tasks-vision Gesture Recognizer
              实现的手势白板。
              <br />
              通过摄像头实时画面识别手势，在屏幕上绘制相应的路径。
            </p>
            <p>
              A gesture whiteboard based on Next.js and Mediapipe tasks-vision
              Gesture Recognizer.
              <br />
              Recognize gestures through real-time camera images and draw
              corresponding paths on the screen.
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
