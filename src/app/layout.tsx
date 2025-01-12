import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hand Gesture Whiteboard",
  description:
    "基于 Next.js 和 Mediapipe tasks-vision Gesture Recognizer 实现的手势白板。" +
    "使用机器学习识别手势，在屏幕上绘制相应的路径" +
    "This site is developed with Next.js and Mediapipe tasks-vision Gesture Recognizer." +
    " Implmenting machine learning to detect hand gesture and draw lines like a whiteboard.",
  openGraph: {
    type: "website",
    url: "https://cygra.github.io/hand-gesture-whiteboard/",
    title: "Hand Gesture Whiteboard",
    description:
      "基于 Next.js 和 Mediapipe tasks-vision Gesture Recognizer 实现的手势白板。" +
      "使用机器学习识别手势，在屏幕上绘制相应的路径" +
      "This site is developed with Next.js and Mediapipe tasks-vision Gesture Recognizer." +
      " Implmenting machine learning to detect hand gesture and draw lines like a whiteboard.",
    siteName: "Hand Gesture Whiteboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <GoogleAnalytics gaId="G-R9FT11Z5TL" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
