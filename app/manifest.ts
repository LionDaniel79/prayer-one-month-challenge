import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "기도운동 1달 도전",
    short_name: "기도 1달",
    description: "한 달 동안 월~토 기도 완료를 기록하는 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/prayer-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/prayer-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/prayer-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
