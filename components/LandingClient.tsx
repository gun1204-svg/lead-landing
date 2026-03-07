"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getLandingConfig, normalizeLK } from "@/lib/landing";

declare global {
  interface Window {
    fbq?: (
      command: "track",
      eventName: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => void;
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

      if (!json?.duplicate && typeof window !== "undefined" && window.fbq) {
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

      <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div
          className={[
            "scroll-area h-full",
            pages.length === 1
              ? "overflow-hidden"
              : "overflow-y-scroll snap-y snap-mandatory",
            "pb-24 lg:pb-0",
          ].join(" ")}
        >
          {pages.map((src) => (
            <section
              key={src}
              className={pages.length === 1 ? "h-[100svh]" : "snap-start snap-always h-[100svh]"}
            >
              <img
                src={src}
                alt=""
                className="w-full h-full object-contain md:object-cover bg-white"
                draggable={false}
              />
            </section>
          ))}
        </div>

        <aside className="hidden lg:block h-full border-l bg-gray-50">
          <div className="sticky top-0 h-[100svh] flex items-center justify-center p-6">
            <div className="w-full max-w-[380px] bg-white p-8 rounded-xl shadow-md">
              <h1 className="text-2xl font-bold text-center text-black">
                {config.title}
              </h1>

              <p className="text-sm text-gray-600 text-center mt-2 mb-4">
                {config.description}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                  className="border p-2 rounded text-black placeholder:text-gray-400"
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <input
                  className="border p-2 rounded text-black placeholder:text-gray-400"
                  placeholder="전화번호"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />

                <label className="text-sm flex items-center gap-2 text-black">
                  <input type="checkbox" required />
                  <span>
                    개인정보 수집 및 이용에 동의합니다{" "}
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
                  className="bg-black text-white py-2 rounded hover:bg-gray-800 disabled:opacity-60"
                >
                  {submitting ? "전송 중..." : config.submitLabel}
                </button>
              </form>
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-black text-white py-3 rounded"
        >
          {config.mobileSubmitLabel ?? config.submitLabel}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md p-6 rounded-xl relative"
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

            <p className="text-sm text-gray-600 text-center mt-2 mb-4">
              {config.description}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                className="border p-3 rounded text-black placeholder:text-gray-400"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <input
                className="border p-3 rounded text-black placeholder:text-gray-400"
                placeholder="전화번호"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <label className="text-sm flex items-center gap-2 text-black">
                <input type="checkbox" required />
                <span>
                  개인정보 수집 및 이용에 동의합니다{" "}
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
                className="bg-black text-white py-3 rounded disabled:opacity-60"
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