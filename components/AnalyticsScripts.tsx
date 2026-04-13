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
    wcs?: {
      inflow: () => void;
      trans: (conv: Record<string, unknown>) => void;
    };
    wcs_do?: () => void;
    wcs_add?: {
      wa?: string;
    };
    _nasa?: Record<string, unknown>;
    ttq?: {
      track: (eventName: string, params?: Record<string, unknown>) => void;
      page?: () => void;
      load?: (pixelId: string, options?: Record<string, unknown>) => void;
      identify?: (params?: Record<string, unknown>) => void;
    };
  }
}

export function trackLeadComplete(params?: {
  landing_key?: string;
  content_name?: string;
  eventID?: string;
  name?: string;
  phone?: string;
}) {
  if (typeof window === "undefined") return;

  const META_PIXEL_ID = "1955884414711088";
  const KAKAO_PIXEL_ID = "4124381110897915848";
  const NAVER_WA = "s_ce4f9169350";

  const landingKey = params?.landing_key ?? "";
  const contentName = params?.content_name ?? "";
  const safeParams: Record<string, unknown> = {
    landing_key: landingKey,
    content_name: contentName,
  };

  // ✅ Meta
  try {
    if (window.fbq) {
      window.fbq(
        "track",
        "Lead",
        safeParams,
        params?.eventID ? { eventID: params.eventID } : undefined
      );
    }
  } catch (e) {
    console.error("Meta Lead track error:", e);
  }

  // ✅ Kakao
  try {
    if (window.kakaoPixel) {
      window.kakaoPixel(KAKAO_PIXEL_ID).participation("Lead");
    }
  } catch (e) {
    console.error("Kakao Lead track error:", e);
  }

  // ✅ Karrot
  try {
    if (window.karrotPixel) {
      window.karrotPixel.track("Lead", safeParams);
    }
  } catch (e) {
    console.error("Karrot Lead track error:", e);
  }

  // ✅ Naver
  try {
    if (!window.wcs_add) window.wcs_add = {};
    window.wcs_add.wa = NAVER_WA;

    if (window.wcs?.trans) {
      window.wcs.trans({ type: "lead" });
    }
  } catch (e) {
    console.error("Naver Lead track error:", e);
  }

  // ✅ TikTok Lead
  try {
    if (window.ttq) {
      window.ttq.track("Lead", {
        landing_key: landingKey,
        content_name: contentName,
        contents: [
          {
            content_id: contentName || `landing_${landingKey}`,
            content_type: "product",
            content_name: contentName || `landing_${landingKey}`,
          },
        ],
      });
    }
  } catch (e) {
    console.error("TikTok Lead track error:", e);
  }
}

export default function AnalyticsScripts() {
  const META_PIXEL_ID = "1955884414711088";
  const KAKAO_PIXEL_ID = "4124381110897915848";
  const KARROT_PIXEL_ID = "1773755788540380001";
  const TIKTOK_PIXEL_ID = "D7EKLTRC77UFN8265M4G";
  const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const NAVER_WA = "s_ce4f9169350";

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

      {/* TikTok Pixel */}
      <Script
        id="tiktok-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");
n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('${TIKTOK_PIXEL_ID}');
  ttq.page();
  ttq.track('ViewContent', {
    contents: [{
      content_id: window.location.pathname || '/',
      content_type: 'product',
      content_name: window.location.pathname || 'landing_page'
    }]
  });
}(window, document, 'ttq');
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

      {/* Naver Analytics */}
      <Script
        id="naver-analytics-lib"
        src="//wcs.naver.net/wcslog.js"
        strategy="afterInteractive"
      />
      <Script
        id="naver-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
if (!window.wcs_add) window.wcs_add = {};
window.wcs_add["wa"] = "${NAVER_WA}";
if (!window._nasa) window._nasa = {};
if (window.wcs) {
  window.wcs.inflow();
  if (window.wcs_do) window.wcs_do();
}
          `,
        }}
      />
    </>
  );
}