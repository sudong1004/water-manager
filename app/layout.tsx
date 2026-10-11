import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "정수기 고객관리", description: "정수기 관리 고객 · 필터 교환 관리" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0369a1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
