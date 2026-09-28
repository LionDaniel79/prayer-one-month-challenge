import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionHeartbeat } from "../components/auth/SessionHeartbeat";

export const metadata: Metadata = {
  title: {
    default: "56사랑",
    template: "%s | 56사랑",
  },
  description: "56공동체 기도운동, 심방신청, 기도요청, 공지",
  applicationName: "56사랑",
  appleWebApp: { capable: true, title: "56사랑", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/56-heart-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/56-heart-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/56-heart-apple-180.png", sizes: "180x180", type: "image/png" }],
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
