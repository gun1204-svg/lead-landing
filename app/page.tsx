"use client";

import { useMemo, useState } from "react";
import { getLandingConfig } from "@/lib/landing";

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

export default function Home() {
  const config = getLandingConfig("00");

  const pages = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `${config.introPath}/${n}.png`;
    });
  }, [config.introPath]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        phone: normalizedPhone,
        landing_key: config.key,

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

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        alert(`전송 실패 (${res.status})\n${text || "(no body)"}`);
        return;
      }

      alert("상담 신청이 접수되었습니다!");
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
        <div className="scroll-area h-full overflow-y-scroll snap-y snap-mandatory pb-24 lg:pb-0">
          {pages.map((src) => (
            <section key={src} className="snap-start snap-always h-[100svh]">
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
              <h1 className="text-2xl font-bold mb-4 text-center text-black">
                {config.title}
              </h1>

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
                  개인정보 수집에 동의합니다.
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
          {config.submitLabel}
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

            <h2 className="text-xl font-bold mb-4 text-center text-black">
              {config.title}
            </h2>

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
                개인정보 수집에 동의합니다.
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="bg-black text-white py-3 rounded disabled:opacity-60"
              >
                {submitting ? "전송 중..." : "상담 신청"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}