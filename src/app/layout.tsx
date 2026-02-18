import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

export const metadata: Metadata = {
  title: isLocal
    ? "[DEV] 외출 플래너"
    : "외출 플래너 - AI 맛집·카페·주차 추천",
  description: "자연어로 맛집, 카페, 주차장을 통합 추천받고 최적 동선을 확인하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const naverClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  return (
    <html lang="ko">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        {naverClientId && (
          <Script
            src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${naverClientId}`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
