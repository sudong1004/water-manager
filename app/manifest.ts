import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "정수기 고객관리",
    short_name: "정수기관리",
    description: "정수기 관리 고객 · 필터 교환 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0369a1",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
