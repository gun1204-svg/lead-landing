import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bienptns.com"),

  title: {
    default: "Bienpartners",
    template: "%s | Bienpartners",
  },

  description:
    "비엔파트너스 마케팅 상담 랜딩페이지. 네이버 광고, 구글 광고, 퍼포먼스 마케팅 전문.",

  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },

  keywords: [
    "비엔파트너스",
    "Bienpartners",
    "마케팅 상담",
    "네이버 광고",
    "구글 광고",
    "퍼포먼스 마케팅",
    "광고 대행",
  ],

  alternates: {
    canonical: "https://bienptns.com",
  },

  openGraph: {
    type: "website",
    url: "https://bienptns.com",
    siteName: "Bienpartners",
    title: "Bienpartners",
    description:
      "비엔파트너스 마케팅 상담 신청. 이름과 전화번호만 남기면 담당자가 연락드립니다.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Bienpartners",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Bienpartners",
    description: "비엔파트너스 마케팅 상담 신청",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ✅ NextAuth SessionProvider 적용 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}