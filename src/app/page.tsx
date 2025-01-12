"use client";

import { useEffect, useRef, useState } from "react";

import {
  FilesetResolver,
  GestureRecognizer,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

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

          drawLandmarks(landmarks, landmarkCanvasCtx, width, height);
        });
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
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "white";

    landmarks.forEach((landmark, ind) => {
      const x = (1 - landmark.x) * width;
      const y = landmark.y * height;

      ctx.fillStyle = "#3370d4";
      if (ind === THUMB_TIP_INDEX || ind === INDEX_FINGER_TIP_INDEX) {
        ctx.fillStyle = "#c82124";
      }
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
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

  return (
    <div className="flex flex-col items-center min-h-screen p-8 w-full justify-center bg-white">
      <a
        href={"https://github.com/Cygra/hand-gesture-whiteboard"}
        className={"fixed top-2 right-2 underline text-black"}
        target={"_blank"}
      >
        Github
      </a>
      <canvas
        ref={landmarkCanvasRef}
        className={"fixed inset-0 z-50"}
        width={canvasSize[0] || 640}
        height={canvasSize[1] || 480}
      />
      <canvas
        ref={strokeCanvasRef}
        className={"fixed inset-0 z-50"}
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
    </div>
  );
}
