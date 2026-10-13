import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "정수기 고객관리", description: "정수기 관리 고객 · 필터 교환 관리",
  applicationName: "정수기관리",
  icons: { apple: "/icons/apple-touch-icon.png", icon: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "정수기관리", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0369a1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
