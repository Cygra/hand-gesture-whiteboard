# 手势白板

![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=for-the-badge&logo=google&logoColor=white)

**[🌐 在线体验](https://cygra.github.io/hand-gesture-whiteboard/)** · [English](README.md) · [日本語](README.ja.md)

基于 Next.js、[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) 手势识别器和 Three.js 构建的 3D 手势白板。只需用手，无需鼠标或触摸，即可在鱼缸式 3D 空间中绘制彩色气球笔触。

![📷 screenshot.png](https://cygra.github.io/hand-gesture-whiteboard/og-image.png)

---

## ✨ 功能特性

| 手势 | 操作 |
|---|---|
| 👌 捏合（食指 + 拇指） | 绘制 3D 气球笔触 |
| 🖐️ 张开手掌挥动 | 产生风力推动气球 |
| ✊ 握拳持续 3 秒 | 清空所有气球 |
| ✌️ / 👍 持续 3 秒 | 切换浅色 / 深色主题 |

- **3D 物理** — 气球飘浮、左右摇摆、碰到六面边界回弹，气球之间相互碰撞
- **手势风吹** — 张开手掌挥动可产生方向性的风，推动气球漂移
- **功能开关** — 可独立开启 / 关闭气球飘动和手势风吹
- **主题切换** — 提供浅色与深色两套配色，切换流畅
- **多语言** — 界面支持英文、中文、日文
- **隐私优先** — 所有处理均在浏览器本地完成，摄像头画面不会被上传或共享

---

## 🛠 技术栈

- **[Next.js 15](https://nextjs.org/)** — React 框架（静态导出至 GitHub Pages）
- **[Three.js](https://threejs.org/)** — 3D 渲染（TubeGeometry 气球、物理循环）
- **[MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer)** — 实时手部关键点与手势检测
- **[NextUI](https://nextui.org/)** — UI 组件库
- **[Tailwind CSS](https://tailwindcss.com/)** — 原子化 CSS 样式

---

## 🚀 本地开发

```sh
npm i
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 并允许摄像头访问。

---

## 🔗 相关项目

- [Danmaku Mask](https://cygra.github.io/danmaku-mask/) — 另一个 MediaPipe + Next.js 项目
