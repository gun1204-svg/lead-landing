import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import Script from "next/script";

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
  title: "비엔파트너스",
  description: "비엔파트너스",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    siteName: "비엔파트너스",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* GTM HEAD */}
        <Script id="gtm-head" strategy="beforeInteractive">
          {`
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id=GTM-5TFNS63T'+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5TFNS63T');
          `}
        </Script>

        {/* NAVER PV SCRIPT - 호출 순서 고정 */}
        <Script
          id="naver-wcs-lib"
          src="//wcs.naver.net/wcslog.js"
          strategy="beforeInteractive"
        />
        <Script id="naver-wcs-init" strategy="beforeInteractive">
          {`
document.addEventListener('DOMContentLoaded', function () {
  window.wcs_add = window.wcs_add || {};
  if (!window.wcs_add.wa) window.wcs_add.wa = "s_ce4f9169350";

  window._nasa = window._nasa || {};

  if (window.wcs) {
    wcs.inflow("bienptns.com");
    if (window.wcs_do) {
      wcs_do(window._nasa);
    }
    window._nasa = {};
  }
});
          `}
        </Script>
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* GTM NOSCRIPT */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5TFNS63T"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        {/* 모든 픽셀 / 추적 스크립트 */}
        <AnalyticsScripts />

        {/* 앱 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}