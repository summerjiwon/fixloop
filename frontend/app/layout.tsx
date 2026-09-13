import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FixLoop",
  description: "AI remote operations agent for multi-location spaces",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
