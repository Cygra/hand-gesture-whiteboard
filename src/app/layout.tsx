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

const siteUrl = "https://cygra.github.io/hand-gesture-whiteboard/";
const title = "Hand Gesture Whiteboard — Draw 3D Balloons with Your Hands";
const description =
  "A real-time 3D gesture whiteboard built with Next.js, MediaPipe Gesture Recognizer, and Three.js. " +
  "Pinch to draw colorful balloon strokes, wave to create wind, and watch them float in a physics-driven 3D space. " +
  "No mouse or touch needed — just your hands and a webcam. " +
  "手势白板 · ジェスチャーホワイトボード";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "hand gesture",
    "whiteboard",
    "3D balloons",
    "MediaPipe",
    "Gesture Recognizer",
    "Next.js",
    "Three.js",
    "webcam",
    "machine learning",
    "real-time",
    "手势白板",
    "ジェスチャーホワイトボード",
  ],
  authors: [{ name: "Cygra", url: "https://github.com/Cygra" }],
  creator: "Cygra",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  verification: { google: "JeBzIDptjs75OZQ6Swe-7AQ-O9hr1ed2kkki_N1JyfY" },
  openGraph: {
    type: "website",
    url: siteUrl,
    title,
    description,
    siteName: "Hand Gesture Whiteboard",
    images: [
      {
        url: `${siteUrl}og-image.png`,
        width: 1275,
        height: 766,
        alt: "Hand Gesture Whiteboard — 3D balloon strokes drawn with hand gestures",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${siteUrl}og-image.png`],
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
