"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getLandingConfig, normalizeLK } from "@/lib/landing";
import LandingFooter from "@/components/LandingFooter";
import {
  trackCTA,
  trackDuplicateLead,
  trackFormStart,
  trackFormSubmit,
  trackFormSuccess,
  trackLandingView,
  trackScrollDepth,
} from "@/lib/tracking";

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
    utm_medium: sp.get("utm_medium") || "",
    utm_campaign: sp.get("utm_campaign") || "",
    utm_term: sp.get("utm_term") || "",
    utm_content: sp.get("utm_content") || "",
  };
}

function generateEventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const concernOptions02 = [
  {
    title: "불룩한 눈 밑 지방",
    desc: "눈 밑이 튀어나와 피곤하고 나이 들어 보이는 인상",
  },
  {
    title: "다크서클로 인해 피곤해 보이는 인상",
    desc: "착색 또는 그림자 때문에 칙칙해 보이는 경우",
  },
  {
    title: "눈 밑이 꺼져 피곤하고 나이들어 보이는 인상",
    desc: "볼륨 부족으로 그늘지고 생기 없어 보이는 경우",
  },
  {
    title: "눈 밑 지방이 불룩하고 피부 처짐과 눈가 주름",
    desc: "불룩함과 처짐, 잔주름이 함께 고민인 경우",
  },
];

function InlineCTA({
  text = "지금 상담 신청하기",
  onClick,
}: {
  text?: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-white px-4 py-5">
      <div className="mx-auto w-full max-w-[760px]">
        <button
          type="button"
          onClick={onClick}
          className="h-13 w-full rounded-2xl bg-black px-5 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition hover:bg-gray-800"
        >
          {text}
        </button>
      </div>
    </div>
  );
}

function TopLeadForm({
  name,
  phone,
  agreed,
  submitting,
  setName,
  setPhone,
  setAgreed,
  handleSubmit,
  handleFormStarted,
  concernsText,
}: {
  name: string;
  phone: string;
  agreed: boolean;
  submitting: boolean;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setAgreed: (v: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleFormStarted: () => void;
  concernsText?: string;
}) {
  return (
    <section id="lead-form-top" className="bg-white px-4 py-6">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
          <div className="bg-[#f7faf9] px-5 py-6 text-center">
            <h2 className="text-[26px] font-bold leading-tight text-black">
              간단 상담 받아보기
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-gray-600">
              이름과 연락처만 남겨주시면
              <br className="sm:hidden" /> 확인 후 빠르게 안내드립니다.
            </p>
          </div>

          <div className="px-5 py-5">
            {concernsText ? (
              <div className="mb-4 rounded-2xl border border-[#bfe7d6] bg-[#f2fffa] px-4 py-4">
                <p className="text-[12px] font-semibold tracking-[0.08em] text-[#0f766e]">
                  선택한 고민
                </p>
                <p className="mt-2 text-[14px] leading-6 text-[#115e59]">
                  {concernsText}
                </p>
              </div>
            ) : null}

            <div className="mb-4 rounded-2xl bg-[#f8faf9] px-4 py-4 text-center text-[13px] leading-5 text-gray-600">
              선택하신 고민을 바탕으로 상담 안내가 진행됩니다.
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                className="h-13 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                placeholder="이름을 입력해주세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={handleFormStarted}
                required
              />

              <input
                className="h-13 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                onFocus={handleFormStarted}
                inputMode="numeric"
                maxLength={13}
                required
              />

              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-black">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-black"
                />
                <span className="font-medium text-gray-800">
                  개인정보 수집 및 이용에 동의합니다
                </span>
              </label>

              <div className="rounded-xl bg-[#f8faf9] px-4 py-3 text-center text-[13px] leading-5 text-gray-600">
                입력해주신 정보는 상담 안내 외 다른 용도로 사용되지 않습니다.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 h-13 rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-60"
              >
                {submitting ? "전송 중..." : "간단 상담 받아보기"}
              </button>

              <p className="text-center text-[12px] leading-5 text-gray-500">
                간단 신청 후 순차적으로 연락드립니다
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function Landing02Content({
  concerns,
  toggleConcern,
  onOpenForm,
  name,
  phone,
  agreed,
  submitting,
  setName,
  setPhone,
  setAgreed,
  handleSubmit,
  handleFormStarted,
}: {
  concerns: string[];
  toggleConcern: (item: string) => void;
  onOpenForm: () => void;
  name: string;
  phone: string;
  agreed: boolean;
  submitting: boolean;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setAgreed: (v: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleFormStarted: () => void;
}) {
  return (
    <>
      <section className="bg-white px-4 py-8">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="text-center">
            <h1 className="text-[28px] font-bold leading-tight text-black">
              눈밑 때문에
              <br />
              피곤해 보인다는 말 자주 들으시나요?
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-gray-600">
              지금 상태를 간단히 확인해보세요
            </p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[13px] font-semibold tracking-[0.12em] text-[#0f766e]">
              SELF CHECK
            </p>
            <h3 className="mt-2 text-[24px] font-bold leading-tight text-black">
              현재 가장 신경 쓰이는 눈밑 고민은 무엇인가요?
            </h3>
            <p className="mt-2 text-[14px] leading-6 text-gray-600">
              해당되는 항목을 선택해주세요. 복수 선택도 가능합니다.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            {concernOptions02.map((item) => {
              const selected = concerns.includes(item.title);

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => toggleConcern(item.title)}
                  className={`group w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selected
                      ? "border-[#10b981] bg-white shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                      : "border-[#d9e7e1] bg-white hover:border-[#9fd5c1] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold transition ${
                        selected
                          ? "border-[#10b981] bg-[#10b981] text-white"
                          : "border-gray-300 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </div>

                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-6 text-black">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[13px] leading-5 text-gray-500">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-[#cfe8dd] bg-white px-4 py-4 text-center">
            <p className="text-[14px] font-medium leading-6 text-gray-700">
              선택 내용은 상담 시 참고용으로만 활용되며,
              <br className="sm:hidden" /> 무리한 권유 없이 상태에 맞게 안내드립니다.
            </p>
          </div>

          {concerns.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 text-center text-[14px] leading-6 text-gray-600">
                선택하신 내용으로 상담 안내가 진행됩니다.
              </div>
              <InlineCTA
                text="선택 내용으로 상담 받아보기"
                onClick={onOpenForm}
              />
            </div>
          )}
        </div>
      </section>

      <TopLeadForm
        name={name}
        phone={phone}
        agreed={agreed}
        submitting={submitting}
        setName={setName}
        setPhone={setPhone}
        setAgreed={setAgreed}
        handleSubmit={handleSubmit}
        handleFormStarted={handleFormStarted}
        concernsText={concerns.length > 0 ? concerns.join(", ") : ""}
      />

      <section className="bg-white px-4 py-8">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-4 text-center">
            <p className="text-[13px] font-semibold tracking-[0.12em] text-[#0f766e]">
              QUICK VIDEO
            </p>
            <h2 className="mt-2 text-[24px] font-bold leading-tight text-black">
              같은 고민이라면 영상으로 먼저 확인해보세요
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-gray-600">
              눈밑 고민 유형과 개선 방향을 짧게 확인할 수 있습니다.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
            <div className="aspect-video w-full">
              <iframe
                src="https://www.youtube.com/embed/iFRJ31FEWgs"
                title="눈밑지방재배치 영상"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <InlineCTA text="영상 보고 상담 남기기" onClick={onOpenForm} />

      <section>
        <img
          src="/intro/02/02.jpg"
          alt="02 랜딩 하단"
          className="block w-full"
          draggable={false}
        />
      </section>

      <InlineCTA text="지금 상담 신청하기" onClick={onOpenForm} />
    </>
  );
}

export default function LandingClient({ landingKey }: { landingKey: string }) {
  const pathname = usePathname();
  const seg1 = pathname?.split("/")[1] || "";

  const lk = useMemo(() => normalizeLK(seg1 || landingKey || "00"), [seg1, landingKey]);
  const config = useMemo(() => getLandingConfig(lk), [lk]);
  const isLanding02 = config.key === "02";

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
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [concerns02, setConcerns02] = useState<string[]>([]);

  const trackedDepths = useRef<Set<number>>(new Set());
  const formStartedRef = useRef(false);

  function toggleConcern02(item: string) {
    setConcerns02((prev) =>
      prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]
    );
  }

  function getTrackingPayload() {
    const utm = getUtmFromLocation();

    return {
      landing_key: config.key,
      hospital_name: config.hospitalName,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_term: utm.utm_term,
      utm_content: utm.utm_content,
    };
  }

  function handleFormStarted() {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackFormStart(getTrackingPayload());
  }

  function openFormWithTracking(location: string) {
    trackCTA(location, getTrackingPayload());
    setOpen(true);
  }

  useEffect(() => {
    const scrollArea = document.querySelector(".scroll-area") as HTMLElement | null;

    trackLandingView(getTrackingPayload());

    const onScroll = () => {
      const currentTop = scrollArea ? scrollArea.scrollTop : window.scrollY;
      const viewportHeight = scrollArea ? scrollArea.clientHeight : window.innerHeight;
      const scrollHeight = scrollArea
        ? scrollArea.scrollHeight
        : document.documentElement.scrollHeight;

      const docHeight = scrollHeight - viewportHeight;
      if (docHeight <= 0) return;

      const percent = Math.round((currentTop / docHeight) * 100);

      for (const depth of [25, 50, 75, 100] as const) {
        if (percent >= depth && !trackedDepths.current.has(depth)) {
          trackedDepths.current.add(depth);
          trackScrollDepth(depth, { landing_key: config.key });
        }
      }
    };

    const target = scrollArea || window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      target.removeEventListener("scroll", onScroll);
    };
  }, [config.key, config.hospitalName, pathname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!isValidPhone(phone)) {
      alert("전화번호를 정확히 입력해주세요.");
      return;
    }

    if (!agreed) {
      alert("개인정보 수집 및 이용 동의가 필요합니다.");
      return;
    }

    setSubmitting(true);

    try {
      const utm = getUtmFromLocation();

      trackFormSubmit({
        landing_key: config.key,
        hospital_name: config.hospitalName,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
      });

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          landing_key: config.key,
          concerns: isLanding02 ? concerns02 : [],

          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          utm_term: utm.utm_term,
          utm_content: utm.utm_content,

          utm,

          event_id: generateEventId(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "전송 실패");
      }

      if (json?.duplicate) {
        trackDuplicateLead({
          landing_key: config.key,
          hospital_name: config.hospitalName,
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          utm_term: utm.utm_term,
          utm_content: utm.utm_content,
        });

        alert("이미 접수된 상담 정보입니다.");
        return;
      }

      trackFormSuccess({
        landing_key: config.key,
        hospital_name: config.hospitalName,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
      });

      setSuccessOpen(true);
      setName("");
      setPhone("");
      setAgreed(false);
      setConcerns02([]);
      setOpen(false);
      formStartedRef.current = false;
    } catch (e) {
      alert("전송 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <main className="w-screen h-[100svh] overflow-hidden bg-white">
        {config.key === "00" && (
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
              className="h-12 object-contain drop-shadow-lg lg:h-20"
            />
          </div>
        )}

        <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div
            className={[
              "scroll-area h-full pb-24 lg:pb-0",
              isLanding02 || isSingleLongImage
                ? "overflow-y-auto"
                : "overflow-y-scroll snap-y snap-mandatory",
            ].join(" ")}
          >
            {isLanding02 ? (
              <Landing02Content
                concerns={concerns02}
                toggleConcern={toggleConcern02}
                onOpenForm={() => openFormWithTracking("inline_cta")}
                name={name}
                phone={phone}
                agreed={agreed}
                submitting={submitting}
                setName={setName}
                setPhone={setPhone}
                setAgreed={setAgreed}
                handleSubmit={handleSubmit}
                handleFormStarted={handleFormStarted}
              />
            ) : (
              <>
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
                            ? "block h-auto w-full bg-white"
                            : "h-full w-full bg-white object-contain md:object-cover"
                        }
                        draggable={false}
                      />
                    </section>
                  );
                })}
              </>
            )}

            <LandingFooter landingKey={config.key} />
          </div>

          <aside className="hidden h-full border-l border-gray-200 bg-[#f8f8f8] lg:block">
            <div className="sticky top-0 h-[100svh] p-6">
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-[380px] rounded-3xl border border-gray-200 bg-white p-8 shadow-[0_16px_40px_rgba(0,0,0,0.10)]">
                  <div className="mb-6 text-center">
                    <h1 className="mt-2 text-2xl font-bold leading-tight text-black">
                      {config.title}
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {config.description}
                    </p>

                    <p className="mt-3 text-[13px] font-medium leading-5 text-[#0f766e]">
                      지금 신청하시면 상담 가능 여부를 빠르게 안내드립니다
                    </p>
                  </div>

                  {isLanding02 && concerns02.length > 0 && (
                    <div className="mb-4 rounded-2xl border border-[#bfe7d6] bg-[#f2fffa] px-4 py-4">
                      <p className="text-[12px] font-semibold tracking-[0.08em] text-[#0f766e]">
                        선택한 고민
                      </p>
                      <p className="mt-2 text-[14px] leading-6 text-[#115e59]">
                        {concerns02.join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="mb-4 rounded-2xl bg-[#f8faf9] px-4 py-4 text-center text-[13px] leading-5 text-gray-600">
                    선택하신 고민을 바탕으로 상담 안내가 진행됩니다.
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                      className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                      placeholder="이름을 입력해주세요"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={handleFormStarted}
                      required
                    />

                    <input
                      className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                      placeholder="010-1234-5678"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                      onFocus={handleFormStarted}
                      inputMode="numeric"
                      maxLength={13}
                      required
                    />

                    <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-black">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 accent-black"
                      />
                      <span className="font-medium text-gray-800">
                        개인정보 수집 및 이용에 동의합니다
                      </span>
                    </label>

                    <div className="rounded-xl bg-[#f8faf9] px-4 py-3 text-center text-[13px] leading-5 text-gray-600">
                      입력해주신 정보는 상담 안내 외 다른 용도로 사용되지 않습니다.
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-1 h-12 rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-60"
                    >
                      {submitting ? "전송 중..." : "간단 상담 받아보기"}
                    </button>

                    <p className="text-center text-[12px] leading-5 text-gray-500">
                      간단 신청 후 순차적으로 연락드립니다
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-3 lg:hidden">
          <button
            onClick={() => openFormWithTracking("mobile_sticky")}
            className="h-12 w-full rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm"
          >
            간단 상담 받아보기
          </button>
        </div>

        {open && (
          <div
            className="fixed inset-0 flex items-end bg-black/60 lg:items-center lg:justify-center lg:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full rounded-t-2xl bg-white p-6 shadow-2xl lg:max-w-md lg:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 text-center">
                <h2 className="mt-2 text-[22px] font-bold text-black">
                  간단 상담 받아보기
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-gray-600">
                  정보를 남겨주시면 확인 후 빠르게 연락드립니다.
                </p>
              </div>

              {isLanding02 && concerns02.length > 0 && (
                <div className="mb-4 rounded-2xl border border-[#bfe7d6] bg-[#f2fffa] px-4 py-4">
                  <p className="text-[12px] font-semibold tracking-[0.08em] text-[#0f766e]">
                    선택한 고민
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-[#115e59]">
                    {concerns02.join(", ")}
                  </p>
                </div>
              )}

              <div className="mb-4 rounded-2xl bg-[#f8faf9] px-4 py-4 text-center text-[13px] leading-5 text-gray-600">
                선택하신 고민을 바탕으로 상담 안내가 진행됩니다.
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  placeholder="이름을 입력해주세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={handleFormStarted}
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                />

                <input
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  onFocus={handleFormStarted}
                  inputMode="numeric"
                  maxLength={13}
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                />

                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-black">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-black"
                  />
                  <span className="font-medium text-gray-800">
                    개인정보 수집 및 이용에 동의합니다
                  </span>
                </label>

                <div className="rounded-xl bg-[#f8faf9] px-4 py-3 text-center text-[13px] leading-5 text-gray-600">
                  상담 안내 외 다른 용도로 사용되지 않습니다.
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition disabled:opacity-60"
                >
                  {submitting ? "전송중..." : "간단 상담 받아보기"}
                </button>

                <p className="text-center text-[12px] leading-5 text-gray-500">
                  신청 후 순차적으로 연락드립니다
                </p>
              </form>
            </div>
          </div>
        )}
      </main>

      {successOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSuccessOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[22px] font-bold text-black">상담 신청 완료</p>
            <p className="mt-3 text-[14px] leading-6 text-gray-600">
              신청이 정상적으로 접수되었습니다.
              <br />
              확인 후 빠르게 연락드리겠습니다.
            </p>
            <button
              onClick={() => setSuccessOpen(false)}
              className="mt-5 h-11 w-full rounded-xl bg-black text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}