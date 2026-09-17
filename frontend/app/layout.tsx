import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], variable: "--font-noto-sans-kr", display: "swap" });

export const metadata: Metadata = {
  title: "FixLoop",
  description: "AI remote operations agent for multi-location spaces",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={notoSansKr.variable}>{children}</body>
    </html>
  );
}
