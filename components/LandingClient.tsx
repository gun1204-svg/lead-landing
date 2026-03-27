"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getLandingConfig, normalizeLK } from "@/lib/landing";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    fbq?: (
      command: "track" | "trackCustom",
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
  }
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function getUtmFromLocation() {
  const sp = new URLSearchParams(window.location.search);
  return {
    utm_source: sp.get("utm_source") || "",
    utm_campaign: sp.get("utm_campaign") || "",
    utm_term: sp.get("utm_term") || "",
    utm_content: sp.get("utm_content") || "",
  };
}

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

function getFbc() {
  const existing = getCookie("_fbc");
  if (existing) return existing;

  if (typeof window === "undefined") return undefined;

  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return undefined;

  return `fb.1.${Date.now()}.${fbclid}`;
}

function generateEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function LandingClient({ landingKey }: { landingKey: string }) {
  const pathname = usePathname();
  const seg1 = pathname?.split("/")[1] || "";

  const lk = useMemo(() => {
    return normalizeLK(seg1 || landingKey || "00");
  }, [seg1, landingKey]);

  const config = useMemo(() => getLandingConfig(lk), [lk]);

  const pages = useMemo(() => {
    const count = config.pageCount ?? 10;
    return Array.from({ length: count }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `${config.introPath}/${n}.png`;
    });
  }, [config.introPath, config.pageCount]);

  const isSingleLongImage = pages.length === 1;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "ViewContent", {
        content_name: `landing_${config.key}`,
        landing_key: config.key,
      });
    }
  }, [config.key]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let fired = false;

    const handleScroll = () => {
      if (fired) return;

      const scrollArea = document.querySelector(".scroll-area") as HTMLElement | null;
      if (!scrollArea) return;

      const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
      if (maxScroll <= 0) return;

      const scrollPercent = (scrollArea.scrollTop / maxScroll) * 100;

      if (scrollPercent >= 50) {
        fired = true;

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "scroll_50",
          landing_key: config.key,
          content_name: `landing_${config.key}`,
        });

        if (window.fbq) {
          window.fbq("trackCustom", "Scroll50", {
            content_name: `landing_${config.key}`,
            landing_key: config.key,
          });
        }

        scrollArea.removeEventListener("scroll", handleScroll);
      }
    };

    const scrollArea = document.querySelector(".scroll-area") as HTMLElement | null;
    if (!scrollArea) return;

    scrollArea.addEventListener("scroll", handleScroll);

    return () => {
      scrollArea.removeEventListener("scroll", handleScroll);
    };
  }, [config.key, pages.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const normalizedPhone = normalizePhone(phone);

    if (!trimmedName || !normalizedPhone) {
      alert("이름/전화번호를 확인해주세요.");
      return;
    }

    const utmFlat = getUtmFromLocation();
    const eventId = generateEventId();
    const pageUrl = window.location.href;
    const fbp = getCookie("_fbp");
    const fbc = getFbc();

    setSubmitting(true);

    try {
      const payload = {
        name: trimmedName,
        phone: normalizedPhone,
        landing_key: config.key,
        event_id: eventId,
        page_url: pageUrl,
        fbp,
        fbc,
        ...utmFlat,
        utm: {
          source: utmFlat.utm_source,
          campaign: utmFlat.utm_campaign,
          term: utmFlat.utm_term,
          content: utmFlat.utm_content,
        },
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        alert(`전송 실패 (${res.status})\n${json?.error || "(no body)"}`);
        return;
      }

      if (!json?.duplicate && typeof window !== "undefined") {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "lead_submit",
          landing_key: config.key,
          content_name: `landing_${config.key}`,
          event_id: eventId,
          page_url: pageUrl,
          name: trimmedName,
          phone: normalizedPhone,
          utm_source: utmFlat.utm_source,
          utm_campaign: utmFlat.utm_campaign,
          utm_term: utmFlat.utm_term,
          utm_content: utmFlat.utm_content,
        });

        if (window.fbq) {
          window.fbq(
            "track",
            "Lead",
            {
              content_name: `landing_${config.key}`,
              landing_key: config.key,
            },
            {
              eventID: eventId,
            }
          );
        }

        if (window.kakaoPixel) {
          window.kakaoPixel("4124381110897915848").participation("Consulting");
        }

        if (window.karrotPixel) {
          window.karrotPixel.track("CompleteRegistration");
        }
      }

      alert(
        json?.duplicate
          ? "이미 접수된 상담 정보입니다."
          : "상담 신청이 접수되었습니다!"
      );

      setName("");
      setPhone("");
      setOpen(false);
    } catch (err: any) {
      alert(`전송 실패 (network)\n${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="w-screen h-[100svh] overflow-hidden bg-white">
      <div
        className="fixed top-4 left-4 z-50 cursor-pointer"
        onClick={() => {
          const scrollArea = document.querySelector(".scroll-area") as HTMLElement | null;
          if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <img
          src="/logo.png"
          alt="비엔파트너스"
          className="h-12 lg:h-20 object-contain drop-shadow-lg"
        />
      </div>

      <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div
          className={[
            "scroll-area h-full",
            isSingleLongImage
              ? "overflow-y-auto"
              : "overflow-y-scroll snap-y snap-mandatory",
            "pb-24 lg:pb-0",
          ].join(" ")}
        >
          {pages.map((src) => {
            const jpgSrc = src.replace(".png", ".jpg");

            return (
              <section
                key={src}
                className={
                  isSingleLongImage
                    ? "w-full"
                    : "snap-start snap-always h-[100svh]"
                }
              >
                <img
                  src={jpgSrc}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = src;
                  }}
                  alt=""
                  className={
                    isSingleLongImage
                      ? "block w-full h-auto bg-white"
                      : "w-full h-full object-contain md:object-cover bg-white"
                  }
                  draggable={false}
                />
              </section>
            );
          })}
        </div>

        <aside className="hidden lg:block h-full border-l border-gray-200 bg-[#f8f8f8]">
          <div className="sticky top-0 h-[100svh] p-6">
            <div className="flex h-full items-center justify-center">
              <div className="w-full max-w-[380px] rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-center text-black leading-tight">
                    {config.title}
                  </h1>

                  <p className="text-sm text-gray-600 text-center mt-2 leading-6">
                    {config.description}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <input
                    className="h-12 border border-gray-300 px-3 rounded-lg text-black placeholder:text-gray-400 outline-none focus:border-black"
                    placeholder="이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />

                  <input
                    className="h-12 border border-gray-300 px-3 rounded-lg text-black placeholder:text-gray-400 outline-none focus:border-black"
                    placeholder="전화번호"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />

                  <label className="text-sm flex items-start gap-2 text-black leading-5">
                    <input type="checkbox" required className="mt-1" />
                    <span>
                      개인정보 수집 및 이용에 동의합니다
                      <br />
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        (개인정보처리방침)
                      </a>{" "}
                      /{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        (이용약관)
                      </a>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-1 h-12 rounded-lg bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60"
                  >
                    {submitting ? "전송 중..." : config.submitLabel}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dataLayer = window.dataLayer || [];
              window.dataLayer.push({
                event: "form_open",
                landing_key: config.key,
                content_name: `landing_${config.key}`,
              });

              if (window.fbq) {
                window.fbq("track", "Contact", {
                  landing_key: config.key,
                });
              }
            }

            setOpen(true);
          }}
          className="w-full h-12 rounded-lg bg-black text-white font-medium shadow-md"
        >
          {config.mobileSubmitLabel ?? config.submitLabel}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center lg:items-center p-0 lg:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md p-6 rounded-t-2xl lg:rounded-2xl relative max-h-[85svh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-black/70 text-xl"
              aria-label="닫기"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-center text-black">
              {config.title}
            </h2>

            <p className="text-sm text-gray-600 text-center mt-2 mb-4 leading-6">
              {config.description}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                className="h-12 border border-gray-300 px-3 rounded-lg text-black placeholder:text-gray-400 outline-none focus:border-black"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <input
                className="h-12 border border-gray-300 px-3 rounded-lg text-black placeholder:text-gray-400 outline-none focus:border-black"
                placeholder="전화번호"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <label className="text-sm flex items-start gap-2 text-black leading-5">
                <input type="checkbox" required className="mt-1" />
                <span>
                  개인정보 수집 및 이용에 동의합니다
                  <br />
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    (개인정보처리방침)
                  </a>{" "}
                  /{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    (이용약관)
                  </a>
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="h-12 rounded-lg bg-black text-white font-medium disabled:opacity-60"
              >
                {submitting ? "전송 중..." : config.mobileSubmitLabel ?? config.submitLabel}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}