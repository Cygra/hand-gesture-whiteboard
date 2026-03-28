import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import type { ThreeState, BalloonState, WindVector, WaveGestureState, HoldState, PinchReleaseState, DrawPoint, HoldActionType } from "@/lib/types";
import {
  THUMB_TIP_INDEX,
  INDEX_FINGER_TIP_INDEX,
  WRIST_INDEX,
  MIDDLE_FINGER_MCP_INDEX,
  SMOOTHING_FACTOR,
  PINCH_RELEASE_GRACE_MS,
  OPEN_PALM_GESTURES,
  FIST_GESTURES,
  THEME_TOGGLE_GESTURES,
} from "@/lib/constants";
import { isPinching } from "@/lib/gesture/pinch";
import { updateWindFromWave } from "@/lib/gesture/wind";
import { updateHoldGesture, clearHoldCountdown } from "@/lib/gesture/hold";
import { drawLandmarks } from "@/lib/gesture/landmarks";
import {
  addPointToActiveStroke,
  releaseActiveStroke,
  clearAllStrokes,
} from "@/lib/balloon/stroke";

type UseGestureLoopOptions = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  landmarkCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasSizeRef: MutableRefObject<{ width: number; height: number }>;
  threeRef: MutableRefObject<ThreeState | null>;
  balloonStateRef: MutableRefObject<BalloonState>;
  windTargetRef: MutableRefObject<WindVector>;
  waveGestureStateRef: MutableRefObject<WaveGestureState>;
  holdStateRef: MutableRefObject<HoldState>;
  pinchReleaseStateRef: MutableRefObject<PinchReleaseState>;
  previousDrawPointRef: MutableRefObject<DrawPoint>;
  enableGestureWindRef: MutableRefObject<boolean>;
  setHoldCountdown: (
    value: { action: HoldActionType; seconds: number } | null
  ) => void;
  toggleThemeMode: () => void;
};

export function useGestureLoop({
  videoRef,
  landmarkCanvasRef,
  canvasSizeRef,
  threeRef,
  balloonStateRef,
  windTargetRef,
  waveGestureStateRef,
  holdStateRef,
  pinchReleaseStateRef,
  previousDrawPointRef,
  enableGestureWindRef,
  setHoldCountdown,
  toggleThemeMode,
}: UseGestureLoopOptions): void {
  // Keep stable refs for callbacks used inside the gesture loop
  const setHoldCountdownRef = useRef(setHoldCountdown);
  const toggleThemeModeRef = useRef(toggleThemeMode);
  useEffect(() => {
    setHoldCountdownRef.current = setHoldCountdown;
  }, [setHoldCountdown]);
  useEffect(() => {
    toggleThemeModeRef.current = toggleThemeMode;
  }, [toggleThemeMode]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
      });
      if (cancelled) return;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      if (cancelled) return;

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
      if (cancelled) return;

      const landmarkCanvas = landmarkCanvasRef.current;
      const landmarkCtx = landmarkCanvas?.getContext("2d");

      let lastWebcamTime = -1;

      const renderLoop = () => {
        if (cancelled) return;
        if (!video || !landmarkCanvas || !landmarkCtx) {
          requestAnimationFrame(renderLoop);
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
        const { width, height } = canvasSizeRef.current;

        if (!result.landmarks || result.landmarks.length === 0) {
          landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
          const now = performance.now();
          if (balloonStateRef.current.activeStroke) {
            if (pinchReleaseStateRef.current.lostAt === null) {
              pinchReleaseStateRef.current.lostAt = now;
            } else if (
              now - pinchReleaseStateRef.current.lostAt >
              PINCH_RELEASE_GRACE_MS
            ) {
              const three = threeRef.current;
              if (three) {
                releaseActiveStroke(
                  balloonStateRef.current,
                  three.scene,
                  pinchReleaseStateRef.current,
                  previousDrawPointRef.current
                );
              }
            }
          }
          waveGestureStateRef.current.active = false;
          clearHoldCountdown(holdStateRef.current, setHoldCountdownRef.current);
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
          const categories = handGestures.map((g) => g.categoryName);
          const hasOpenPalm = categories.some((c) =>
            OPEN_PALM_GESTURES.includes(c)
          );
          const hasFist = categories.some((c) => FIST_GESTURES.includes(c));
          const hasThemeToggle = categories.some((c) =>
            THEME_TOGGLE_GESTURES.includes(c)
          );

          openPalmDetected = openPalmDetected || hasOpenPalm;
          fistDetected = fistDetected || hasFist;
          themeGestureDetected = themeGestureDetected || hasThemeToggle;

          const pinching = isPinching(
            landmarks[THUMB_TIP_INDEX],
            landmarks[INDEX_FINGER_TIP_INDEX],
            landmarks[WRIST_INDEX],
            landmarks[MIDDLE_FINGER_MCP_INDEX]
          );
          const canDraw = pinching && !hasFist;
          isConnected = isConnected || canDraw;

          if (canDraw) {
            const indexTip = landmarks[INDEX_FINGER_TIP_INDEX];
            const x = (1 - indexTip.x) * width;
            const y = indexTip.y * height;

            if (
              !previousDrawPointRef.current.x &&
              !previousDrawPointRef.current.y
            ) {
              previousDrawPointRef.current.x = x;
              previousDrawPointRef.current.y = y;
            }

            const smoothedX =
              previousDrawPointRef.current.x +
              SMOOTHING_FACTOR * (x - previousDrawPointRef.current.x);
            const smoothedY =
              previousDrawPointRef.current.y +
              SMOOTHING_FACTOR * (y - previousDrawPointRef.current.y);

            const three = threeRef.current;
            if (three) {
              addPointToActiveStroke(
                smoothedX,
                smoothedY,
                three,
                canvasSizeRef.current,
                balloonStateRef.current
              );
            }
            previousDrawPointRef.current.x = smoothedX;
            previousDrawPointRef.current.y = smoothedY;
          }

          drawLandmarks(
            landmarks,
            landmarkCtx,
            landmarkCanvas.width,
            landmarkCanvas.height,
            canDraw
          );
        });

        if (enableGestureWindRef.current && openPalmDetected) {
          const hand = result.landmarks[0];
          const wrist = hand?.[0];
          if (wrist) {
            // Mirror x to match the camera-flipped canvas
            const wristX = (1 - wrist.x) * width;
            const wristY = wrist.y * height;
            updateWindFromWave(
              wristX,
              wristY,
              wrist.z,
              width,
              height,
              waveGestureStateRef.current,
              windTargetRef.current,
              performance.now()
            );
          }
        } else {
          waveGestureStateRef.current.active = false;
        }

        const nowMs = performance.now();
        const three = threeRef.current;

        updateHoldGesture(
          "clear",
          fistDetected,
          nowMs,
          holdStateRef.current,
          setHoldCountdownRef.current,
          () => {
            if (three) {
              clearAllStrokes(
                balloonStateRef.current,
                three.scene,
                pinchReleaseStateRef.current,
                previousDrawPointRef.current
              );
            }
          }
        );
        updateHoldGesture(
          "theme",
          themeGestureDetected,
          nowMs,
          holdStateRef.current,
          setHoldCountdownRef.current,
          () => toggleThemeModeRef.current()
        );

        if (isConnected) {
          pinchReleaseStateRef.current.lostAt = null;
        } else if (balloonStateRef.current.activeStroke) {
          if (pinchReleaseStateRef.current.lostAt === null) {
            pinchReleaseStateRef.current.lostAt = nowMs;
          } else if (
            nowMs - pinchReleaseStateRef.current.lostAt >
            PINCH_RELEASE_GRACE_MS
          ) {
            if (three) {
              releaseActiveStroke(
                balloonStateRef.current,
                three.scene,
                pinchReleaseStateRef.current,
                previousDrawPointRef.current
              );
            }
          }
        }

        requestAnimationFrame(renderLoop);
      };

      renderLoop();
    };

    start();

    const capturedVideoRef = videoRef;
    const capturedHoldStateRef = holdStateRef;
    return () => {
      cancelled = true;
      const video = capturedVideoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      clearHoldCountdown(capturedHoldStateRef.current, setHoldCountdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
