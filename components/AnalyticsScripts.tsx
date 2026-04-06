"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbq?: (
      command: "track" | "trackCustom" | "init",
      eventName: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => void;
    kakaoPixel?: (
      pixelId: string
    ) => {
      pageView: () => void;
      participation: (tag: string) => void;
    };
    karrotPixel?: {
      init: (pixelId: string) => void;
      track: (eventName: string, params?: Record<string, unknown>) => void;
    };
    clarity?: (...args: unknown[]) => void;
  }
}

export default function AnalyticsScripts() {
  const META_PIXEL_ID = "1955884414711088";
  const KAKAO_PIXEL_ID = "4124381110897915848";
  const KARROT_PIXEL_ID = "1773755788540380001";
  const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

  return (
    <>
      {/* Microsoft Clarity */}
      {CLARITY_PROJECT_ID ? (
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
            `,
          }}
        />
      ) : null}

      {/* Meta Pixel */}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];
t=b.createElement(e);t.async=!0;
t.src=v;
s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s);
}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
          `,
        }}
      />

      {/* Kakao Pixel */}
      <Script
        id="kakao-pixel-lib"
        src="https://t1.daumcdn.net/kas/static/kp.js"
        strategy="afterInteractive"
      />
      <Script
        id="kakao-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function initKakaoPixel() {
  function tryInit() {
    if (window.kakaoPixel) {
      window.kakaoPixel('${KAKAO_PIXEL_ID}').pageView();
      return;
    }
    setTimeout(tryInit, 300);
  }
  tryInit();
})();
          `,
        }}
      />

      {/* Karrot Pixel */}
      <Script
        id="karrot-pixel-lib"
        src="https://karrot-pixel.business.daangn.com/karrot-pixel.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.karrotPixel) {
            window.karrotPixel.init(KARROT_PIXEL_ID);
            window.karrotPixel.track("ViewPage");
          }
        }}
      />
    </>
  );
}