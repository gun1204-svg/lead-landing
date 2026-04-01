"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getLandingConfig, normalizeLK } from "@/lib/landing";
import LandingFooter from "@/components/LandingFooter";

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function formatPhoneInput(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length < 4) return numbers;
  if (numbers.length < 8) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

function isValidPhone(phone: string) {
  const numbers = normalizePhone(phone);
  return /^01\d{8,9}$/.test(numbers);
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

function generateEventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const concernOptions02 = [
  "불룩한 눈 밑 지방",
  "다크서클로 인해 피곤해 보이는 인상",
  "눈 밑이 꺼져 피곤하고 나이들어 보이는 인상",
  "눈 밑 지방이 불룩하고 피부 처짐과 눈가 주름",
];

function Landing02Content({
  concerns,
  toggleConcern,
}: {
  concerns: string[];
  toggleConcern: (item: string) => void;
}) {
  return (
    <>
      {/* ✅ 이미지 1장 */}
      <section>
        <img
          src="/intro/02/01.jpg"
          alt="02 랜딩"
          className="w-full"
        />
      </section>

      {/* ✅ 유튜브 */}
      <section className="px-4 py-8">
        <h2 className="text-center text-xl font-bold mb-4">
          영상으로 먼저 확인하세요
        </h2>

        <div className="aspect-video rounded-xl overflow-hidden shadow">
          <iframe
            src="https://www.youtube.com/embed/iFRJ31FEWgs"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </section>

      {/* ✅ 체크박스 */}
      <section className="px-4 py-8 bg-[#eef8f4]">
        <h3 className="text-center text-xl font-bold mb-4">
          눈 밑 고민이 무엇인가요?
        </h3>

        <div className="bg-white p-4 rounded-xl space-y-3">
          {concernOptions02.map((item) => {
            const selected = concerns.includes(item);

            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleConcern(item)}
                className="flex items-start gap-3 w-full text-left"
              >
                <div
                  className={`w-5 h-5 border rounded ${
                    selected ? "bg-green-500 border-green-500" : "border-gray-300"
                  }`}
                />

                <span className="text-sm">{item}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function LandingClient({ landingKey }: { landingKey: string }) {
  const pathname = usePathname();
  const seg1 = pathname?.split("/")[1] || "";

  const lk = useMemo(() => normalizeLK(seg1 || landingKey || "00"), [seg1, landingKey]);
  const config = useMemo(() => getLandingConfig(lk), [lk]);

  const isLanding02 = config.key === "02";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const [concerns02, setConcerns02] = useState<string[]>([]);

  function toggleConcern02(item: string) {
    setConcerns02((prev) =>
      prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return alert("이름 입력");
    if (!isValidPhone(phone)) return alert("전화번호 확인");
    if (!agreed) return alert("동의 필요");

    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: normalizePhone(phone),
          landing_key: config.key,
          concerns: concerns02,
          utm: getUtmFromLocation(),
          event_id: generateEventId(),
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      setSuccessOpen(true);
      setName("");
      setPhone("");
      setAgreed(false);
      setConcerns02([]);
      setOpen(false);
    } catch (e) {
      alert("전송 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <main className="w-full h-screen overflow-y-auto bg-white">
        {isLanding02 ? (
          <Landing02Content
            concerns={concerns02}
            toggleConcern={toggleConcern02}
          />
        ) : null}

        <LandingFooter landingKey={config.key} />

        {/* 하단 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white p-3 border-t">
          <button
            onClick={() => setOpen(true)}
            className="w-full h-12 bg-black text-white rounded-lg"
          >
            무료 상담 신청
          </button>
        </div>

        {/* 모달 */}
        {open && (
          <div className="fixed inset-0 bg-black/60 flex items-end">
            <div className="bg-white w-full p-6 rounded-t-xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 border px-3"
                />

                <input
                  placeholder="전화번호"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  className="w-full h-12 border px-3"
                />

                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  개인정보 동의
                </label>

                <button className="w-full h-12 bg-black text-white rounded-lg">
                  {submitting ? "전송중..." : "신청하기"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* 완료 팝업 */}
      {successOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl text-center">
            <p>신청 완료!</p>
            <button
              onClick={() => setSuccessOpen(false)}
              className="mt-3 bg-black text-white px-4 py-2 rounded"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}