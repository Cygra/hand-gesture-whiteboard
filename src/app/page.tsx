"use client";

import { useRef, useState } from "react";

import {
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@nextui-org/modal";
import { Button } from "@nextui-org/button";
import { Link } from "@nextui-org/link";

import { useAppSettings } from "@/hooks/useAppSettings";
import { useThreeScene } from "@/hooks/useThreeScene";
import { useGestureLoop } from "@/hooks/useGestureLoop";
import { THEME_PALETTES } from "@/lib/themes";
import { getUiText, LANG_OPTIONS } from "@/lib/i18n";
import type { BalloonState, HoldActionType, HoldState, PinchReleaseState, DrawPoint } from "@/lib/types";

export default function Home() {
  const [canvasSize, setCanvasSize] = useState([0, 0]);
  const [holdCountdown, setHoldCountdown] = useState<{
    action: HoldActionType;
    seconds: number;
  } | null>(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const {
    themeMode,
    toggleThemeMode,
    enableBalloonFall,
    setEnableBalloonFall,
    enableGestureWind,
    setEnableGestureWind,
    locale,
    setLocale,
    enableBalloonFallRef,
    enableGestureWindRef,
    windStateRef,
    windTargetRef,
    waveGestureStateRef,
  } = useAppSettings();

  // DOM refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);

  // Gesture processing refs
  const previousDrawPointRef = useRef<DrawPoint>({ x: 0, y: 0 });
  const balloonStateRef = useRef<BalloonState>({
    strokes: [],
    activeStroke: null,
    idSeed: 0,
    tankDepth: 360,
  });
  const holdStateRef = useRef<HoldState>({
    action: null,
    token: 0,
    startedAt: 0,
    pendingLostAt: null,
    lastShownSecond: 0,
    rearmBlockedAction: null,
  });
  const pinchReleaseStateRef = useRef<PinchReleaseState>({ lostAt: null });

  const { threeRef, canvasSizeRef } = useThreeScene({
    containerRef: threeContainerRef,
    themeMode,
    balloonStateRef,
    windStateRef,
    windTargetRef,
    enableBalloonFallRef,
    onResize: (w, h) => setCanvasSize([w, h]),
  });

  useGestureLoop({
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
  });

  const uiText = getUiText(locale, themeMode);
  const currentLangLabel =
    LANG_OPTIONS.find((o) => o.value === locale)?.label ?? "EN";
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

        {/* Row 2: feature toggles */}
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Button
            onPress={() => setEnableBalloonFall((prev) => !prev)}
            color={enableBalloonFall ? "success" : "default"}
            variant="shadow"
            size="sm"
          >
            {enableBalloonFall ? uiText.fallOn : uiText.fallOff}
          </Button>

          <Button
            onPress={() => setEnableGestureWind((prev) => !prev)}
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
              {holdCountdown.action === "clear"
                ? uiText.holdClear
                : uiText.holdTheme}
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
          <ModalHeader className="flex flex-col gap-1">
            {uiText.aboutTitle}
          </ModalHeader>
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
