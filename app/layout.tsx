import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionHeartbeat } from "../components/auth/SessionHeartbeat";

export const metadata: Metadata = {
  title: "기도운동 1달 도전",
  description: "한 달 동안 월~토 기도 완료를 기록하는 앱",
  applicationName: "기도운동 1달 도전",
  icons: {
    icon: [
      { url: "/icons/prayer-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/prayer-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/prayer-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><SessionHeartbeat />{children}</body>
    </html>
  );
}
