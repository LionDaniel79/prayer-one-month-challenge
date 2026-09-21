import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기도운동 1달 도전",
  description: "한 달 동안 월~토 기도 완료를 기록하는 앱",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
