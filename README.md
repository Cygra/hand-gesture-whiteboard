# Hand Gesture Whiteboard

![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=for-the-badge&logo=google&logoColor=white)

**[🌐 Live Demo](https://cygra.github.io/hand-gesture-whiteboard/)** · [中文](README.zh.md) · [日本語](README.ja.md)

A 3D gesture whiteboard built with Next.js, [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) Gesture Recognizer, and Three.js. Draw colorful 3D balloon strokes in a fish-tank-like scene using nothing but your hands — no mouse, no touch required.

![📷 screenshot.png](https://cygra.github.io/hand-gesture-whiteboard/og-image.png)

---

## ✨ Features

| Gesture | Action |
|---|---|
| 👌 Pinch (index + thumb) | Draw a 3D balloon stroke |
| 🖐️ Open palm wave | Generate wind that moves balloons |
| ✊ Hold fist 3 s | Clear all balloons |
| ✌️ / 👍 Hold 3 s | Toggle light / dark theme |

- **3D physics** — balloons float, drift with sway, bounce off all six walls, and collide with each other
- **Gesture wind** — open-palm motion creates a directional breeze that nudges balloons
- **Toggles** — independently enable / disable balloon floating and gesture wind
- **Themes** — light and dark palettes with smooth transitions
- **i18n** — UI available in English, 中文, and 日本語
- **Privacy-first** — all processing runs in the browser; camera footage is never uploaded

---

## 🛠 Tech Stack

- **[Next.js 15](https://nextjs.org/)** — React framework (static export for GitHub Pages)
- **[Three.js](https://threejs.org/)** — 3D rendering (TubeGeometry balloons, physics loop)
- **[MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer)** — real-time hand landmark & gesture detection
- **[NextUI](https://nextui.org/)** — UI component library
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling

---

## 🚀 Getting Started

```sh
npm i
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and allow camera access.

---

## 🔗 Related Projects

- [Danmaku Mask](https://cygra.github.io/danmaku-mask/) — another MediaPipe + Next.js project
