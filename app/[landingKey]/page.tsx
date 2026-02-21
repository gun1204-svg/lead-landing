"use client";

import { useState } from "react";

const pages = [
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

function normalizeLandingKey(s: string) {
  const v = (s || "").trim();
  if (!/^\d{1,2}$/.test(v)) return "00";
  return v.padStart(2, "0");
}

export default function LandingPage({ params }: { params: { landingKey: string } }) {
  const landing_key = normalizeLandingKey(params.landingKey);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const qs = new URLSearchParams(window.location.search);
    const utm = {
      source: qs.get("utm_source") || "",
      campaign: qs.get("utm_campaign") || "",
      term: qs.get("utm_term") || "",
      content: qs.get("utm_content") || "",
    };

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, utm, landing_key }), // ✅ 핵심
    });

    if (!res.ok) {
      alert("전송 실패");
      return;
    }

    alert("상담 신청이 접수되었습니다!");
    setName("");
    setPhone("");
  }

  return (
    <main className="w-screen h-[100svh] overflow-hidden bg-white">
      {/* 좌측 상단 로고 (클릭 시 1페이지로 이동) */}
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
        {/* 왼쪽: 소개서 스크롤 */}
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

        {/* 오른쪽: PC 고정 상담 폼 */}
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
                  className="bg-black text-white py-2 rounded hover:bg-gray-800"
                >
                  무료 상담 신청
                </button>
              </form>

              <div className="mt-6 text-xs text-gray-700 text-center">
                대표번호: 010-3703-1068
              </div>

              {/* 디버그 표시(원하면 나중에 삭제) */}
              <div className="mt-2 text-[11px] text-gray-400 text-center">
                landing_key: {landing_key}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 모바일: 하단 고정 버튼 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-black text-white py-3 rounded"
        >
          무료 상담 신청
        </button>
      </div>

      {/* 모바일: 모달 폼 */}
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

              <button type="submit" className="bg-black text-white py-3 rounded">
                상담 신청
              </button>
            </form>

            <div className="mt-4 text-xs text-gray-700 text-center">
              대표번호: 010-3703-1068
            </div>
          </div>
        </div>
      )}
    </main>
  );
}