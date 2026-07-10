import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KDS OS",
  description: "산만한 나를 위한 개인 운영 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={mono.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}