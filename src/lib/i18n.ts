import type { Locale, ThemeMode } from "./types";
import { JITTER_GRACE_SECONDS_TEXT } from "./constants";

export type UiText = {
  drawHint: string;
  featureHint: string;
  jitterHint: string;
  holdClear: string;
  holdTheme: string;
  themeButton: string;
  fallOn: string;
  fallOff: string;
  windOn: string;
  windOff: string;
  about: string;
  aboutTitle: string;
  aboutDesc1: string;
  aboutDesc2: string;
  otherProjects: string;
  privacyNotice: string;
};

export const LANG_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
];

export function getUiText(locale: Locale, themeMode: ThemeMode): UiText {
  if (locale === "zh") {
    return {
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
      aboutDesc2:
        "通过摄像头实时画面识别手势，在 3D 鱼缸空间里绘制长条气球并自由飘动。",
      otherProjects: "其他 Mediapipe + Next.js 项目：",
      privacyNotice:
        "🔒 所有处理均在您的浏览器本地完成，摄像头画面不会被上传或共享。",
    };
  }

  if (locale === "ja") {
    return {
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
    };
  }

  return {
    drawHint:
      "Connect your index finger tip and thumb tip (like 👌) to create 3D balloons.",
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
}
