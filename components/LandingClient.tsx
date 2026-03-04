"use client";

import { useMemo, useState } from "react";

const allPages = [
  "/intro/01.png",
  "/intro/02.png",
  "/intro/03.png",
  "/intro/04.png",
  "/intro/05.png",
  "/intro/06.png",
  "/intro/07.png",
  "/intro/08.png",
  "/intro/09.png",
  "/intro/10.png",
];

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
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

export default function LandingClient({ landingKey }: { landingKey: string }) {
  const pages = landingKey === "01"
    ? ["/intro/09.png"]
    : allPages;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lk = useMemo(() => normalizeLK(landingKey), [landingKey]);


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
        landing_key: lk,

        // ✅ 1) DB 컬럼(평평한 형태) 대응
        ...utmFlat,

        // ✅ 2) 기존 백엔드가 utm 객체를 기대해도 동작하도록 호환(둘 다 보냄)
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
        // ✅ 원인 파악용: 상태코드 + 서버 응답 표시
        alert(`전송 실패 (${res.status})\n${text || "(no body)"}`);
        return;
      }

      alert("상담 신청이 접수되었습니다!");
      setName("");
      setPhone("");
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
                비엔파트너스 마케팅 상담
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
                  {submitting ? "전송 중..." : "무료 상담 신청"}
                </button>
              </form>

              <div className="mt-6 text-xs text-gray-700 text-center">
                대표번호: 010-3703-1068
              </div>

              <div className="mt-2 text-[10px] text-gray-400 text-center">
                landing_key: {lk}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-black text-white py-3 rounded"
        >
          무료 상담 신청
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
              비엔파트너스 마케팅 상담
            </h2>

            <form
              onSubmit={async (e) => {
                await handleSubmit(e);
                // 전송 성공/실패와 무관하게 닫고 싶지 않으면 여기서 setOpen(false) 제거
                setOpen(false);
              }}
              className="flex flex-col gap-4"
            >
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

            <div className="mt-4 text-xs text-gray-700 text-center">
              대표번호: 010-3703-1068
            </div>

            <div className="mt-2 text-[10px] text-gray-400 text-center">
              landing_key: {lk}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}