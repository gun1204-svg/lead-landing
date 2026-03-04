"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "";
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

const defaultPages00 = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `/intro/00/${n}.png`;
});

export default function LandingClient({ landingKey }: { landingKey: string }) {
  const pathname = usePathname();
  const seg1 = pathname?.split("/")[1]; // "/01" -> "01"

  // ✅ pathname 우선으로 landingKey 확정
  const lk = useMemo(() => normalizeLK(seg1) || normalizeLK(landingKey) || "00", [seg1, landingKey]);

  // ✅ lk 기준으로 이미지 세트 선택
  const pages = useMemo(() => {
    if (lk === "01") return ["/intro/01/09.png"];
    return defaultPages00;
  }, [lk]);

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
        landing_key: lk,
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
    } catch (err: any) {
      alert(`전송 실패 (network)\n${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="w-screen h-[100svh] overflow-hidden bg-white">
      {/* ... 위 UI 동일 ... */}

      <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div className="scroll-area h-full overflow-y-scroll snap-y snap-mandatory pb-24 lg:pb-0">
          {pages.map((src) => (
            <section key={src} className="snap-start snap-always h-[100svh]">
              <img src={src} alt="" className="w-full h-full object-contain md:object-cover bg-white" draggable={false} />
            </section>
          ))}
        </div>

        {/* ... 폼 동일 ... */}

        <div className="mt-2 text-[10px] text-gray-400 text-center">
          landing_key: {lk}
        </div>
      </div>

      {/* ... 모바일 모달 동일 ... */}
    </main>
  );
}