# ジェスチャーホワイトボード

![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=for-the-badge&logo=google&logoColor=white)

**[🌐 デモを見る](https://cygra.github.io/hand-gesture-whiteboard/)** · [English](README.md) · [中文](README.zh.md)

Next.js、[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) ジェスチャー認識、Three.js で構築した 3D ジェスチャーホワイトボード。マウスもタッチも不要 — 手だけで、3D 水槽のような空間にカラフルなバルーンストロークを描くことができます。

![📷 screenshot.png](https://cygra.github.io/hand-gesture-whiteboard/og-image.png)

---

## ✨ 機能

| ジェスチャー | 操作 |
|---|---|
| 👌 ピンチ（人差し指 + 親指） | 3D バルーンストロークを描く |
| 🖐️ 手のひらを広げて振る | 風を起こしてバルーンを動かす |
| ✊ 握りこぶしを 3 秒キープ | すべてのバルーンを消去 |
| ✌️ / 👍 3 秒キープ | ライト / ダークテーマを切り替え |

- **3D 物理演算** — バルーンが浮遊・揺れ、6 面の壁で跳ね返り、バルーン同士が衝突・反発
- **ジェスチャー風** — 手のひらを振ると方向性のある風が発生し、バルーンを流す
- **個別トグル** — バルーンの浮遊とジェスチャー風を独立してオン / オフ可能
- **テーマ切替** — ライト / ダーク 2 種類のカラーパレット
- **多言語対応** — UI は English・中文・日本語に対応
- **プライバシー重視** — すべての処理はブラウザ内のみ。カメラ映像はアップロード・共有されません

---

## 🛠 技術スタック

- **[Next.js 15](https://nextjs.org/)** — React フレームワーク（GitHub Pages 向け静的エクスポート）
- **[Three.js](https://threejs.org/)** — 3D レンダリング（TubeGeometry バルーン・物理ループ）
- **[MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer)** — リアルタイム手のランドマーク・ジェスチャー検出
- **[NextUI](https://nextui.org/)** — UI コンポーネントライブラリ
- **[Tailwind CSS](https://tailwindcss.com/)** — ユーティリティファーストの CSS

---

## 🚀 ローカル開発

```sh
npm i
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開き、カメラへのアクセスを許可してください。

---

## 🔗 関連プロジェクト

- [Danmaku Mask](https://cygra.github.io/danmaku-mask/) — もうひとつの MediaPipe + Next.js プロジェクト
