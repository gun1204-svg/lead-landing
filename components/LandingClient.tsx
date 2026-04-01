"use client";

import { useMemo, useState } from "react";
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
      {/* 상단 이미지 */}
      <section>
        <img
          src="/intro/02/01.jpg"
          alt="02 랜딩 상단"
          className="block w-full"
          draggable={false}
        />
      </section>

      {/* 유튜브 */}
      <section className="px-4 py-8 bg-white">
        <div className="mx-auto w-full max-w-[760px]">
          <h2 className="mb-4 text-center text-xl font-bold text-black">
            영상으로 먼저 확인하세요
          </h2>

          <div className="aspect-video overflow-hidden rounded-xl shadow">
            <iframe
              src="https://www.youtube.com/embed/iFRJ31FEWgs"
              title="눈밑지방재배치 영상"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      </section>

      {/* 체크박스 */}
      <section className="bg-[#eef8f4] px-4 py-8">
        <div className="mx-auto w-full max-w-[760px]">
          <h3 className="mb-4 text-center text-xl font-bold text-black">
            눈 밑 고민이 무엇인가요?
          </h3>

          <div className="space-y-3 rounded-xl bg-white p-4">
            {concernOptions02.map((item) => {
              const selected = concerns.includes(item);

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleConcern(item)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <div
                    className={`mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[12px] ${
                      selected
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </div>

                  <span className="text-sm leading-6 text-black">{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 하단 이미지 */}
      <section>
        <img
          src="/intro/02/02.jpg"
          alt="02 랜딩 하단"
          className="block w-full"
          draggable={false}
        />
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

    if (!name.trim()) {
      alert("이름 입력");
      return;
    }

    if (!isValidPhone(phone)) {
      alert("전화번호 확인");
      return;
    }

    if (!agreed) {
      alert("동의 필요");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          landing_key: config.key,
          concerns: concerns02,
          utm: getUtmFromLocation(),
          event_id: generateEventId(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "전송 실패");
      }

      if (json?.duplicate) {
        alert("이미 접수된 상담 정보입니다.");
        return;
      }

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

        <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-3">
          <button
            onClick={() => setOpen(true)}
            className="h-12 w-full rounded-lg bg-black text-white"
          >
            무료 상담 신청
          </button>
        </div>

        {open && (
          <div
            className="fixed inset-0 flex items-end bg-black/60"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full rounded-t-xl bg-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {concerns02.length > 0 && (
                  <div className="rounded-lg bg-[#f2fffa] px-4 py-3 text-sm text-[#0f766e]">
                    선택한 고민: {concerns02.join(", ")}
                  </div>
                )}

                <input
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 w-full border px-3"
                />

                <input
                  placeholder="전화번호"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  inputMode="numeric"
                  maxLength={13}
                  className="h-12 w-full border px-3"
                />

                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  개인정보 동의
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-lg bg-black text-white disabled:opacity-60"
                >
                  {submitting ? "전송중..." : "신청하기"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {successOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60"
          onClick={() => setSuccessOpen(false)}
        >
          <div
            className="rounded-xl bg-white p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p>신청 완료!</p>
            <button
              onClick={() => setSuccessOpen(false)}
              className="mt-3 rounded bg-black px-4 py-2 text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}