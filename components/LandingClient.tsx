"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getLandingConfig, normalizeLK } from "@/lib/landing";
import LandingFooter from "@/components/LandingFooter";
import { trackLeadComplete } from "@/components/AnalyticsScripts";
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
  text = "상담 신청하기",
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

function FormMessage({
  submitError,
  submitInfo,
}: {
  submitError: string;
  submitInfo: string;
}) {
  if (!submitError && !submitInfo) return null;

  return (
    <div className="space-y-2">
      {submitError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium leading-5 text-red-600">
          {submitError}
        </div>
      ) : null}

      {submitInfo ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] font-medium leading-5 text-gray-600">
          {submitInfo}
        </div>
      ) : null}
    </div>
  );
}

function RequiredVisitNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-[#dce9e3] bg-[#f0f7f4] px-4 py-4 text-center"
          : "rounded-2xl border border-[#dce9e3] bg-[#f0f7f4] px-5 py-5 text-center"
      }
    >
      <p className="text-[15px] font-semibold text-[#0f766e]">! 필독 !</p>
      <p className="mt-2 text-[14px] leading-6 text-gray-800">
        이벤트 신청 후{" "}
        <span className="font-semibold text-[#0f766e]">2주 이내 내원상담</span>이 가능하신
        분들만 신청해주세요.
      </p>
      <p className="mt-1 text-[13px] leading-5 text-gray-600">
        ※ 빠른 상담 진행을 위해 일정 가능하신 분만 접수 부탁드립니다.
      </p>
    </div>
  );
}

function TopLeadForm({
  name,
  phone,
  agreed,
  submitting,
  submitError,
  submitInfo,
  setName,
  setPhone,
  setAgreed,
  handleSubmit,
  handleFormStarted,
}: {
  name: string;
  phone: string;
  agreed: boolean;
  submitting: boolean;
  submitError: string;
  submitInfo: string;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setAgreed: (v: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleFormStarted: () => void;
}) {
  return (
    <section id="lead-form-top" className="bg-white px-4 py-6">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
          <div className="px-5 py-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <RequiredVisitNotice />

              <input
                className="h-13 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                placeholder="이름을 입력해주세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={handleFormStarted}
                disabled={submitting}
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
                disabled={submitting}
                required
              />

              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-black">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-black"
                  disabled={submitting}
                />
                <span className="font-medium text-gray-800">
                  개인정보 수집 및 이용에 동의합니다
                </span>
              </label>

              <div className="rounded-xl bg-[#f8faf9] px-4 py-3 text-center text-[13px] leading-5 text-gray-600">
                입력해주신 정보는 상담 안내 외 다른 용도로 사용되지 않습니다.
              </div>

              <FormMessage submitError={submitError} submitInfo={submitInfo} />

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="mt-1 h-13 rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "전송 중..." : "상담 신청하기"}
              </button>
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
  submitError,
  submitInfo,
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
  submitError: string;
  submitInfo: string;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setAgreed: (v: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleFormStarted: () => void;
}) {
  const leadFormRef = useRef<HTMLDivElement | null>(null);

  function handleConcernClick(item: string) {
    const wasSelected = concerns.includes(item);
    toggleConcern(item);

    if (!wasSelected) {
      window.setTimeout(() => {
        leadFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 180);
    }
  }

  return (
    <>
      <section className="bg-[#f7faf8] px-4 py-10">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="rounded-[28px] border border-[#dce9e3] bg-white px-6 py-8 text-center shadow-[0_12px_32px_rgba(0,0,0,0.05)]">
            <p className="text-[12px] font-semibold tracking-[0.18em] text-[#0f766e]">
              SELF CHECK
            </p>

            <h1 className="mt-3 text-[29px] font-bold leading-[1.35] text-black sm:text-[32px]">
              눈밑 고민,
              <br />
              어떤 유형에 가까우신가요?
            </h1>

            <p className="mt-3 text-[15px] leading-6 text-gray-600">
              현재 가장 신경 쓰이는 고민을 선택해 주세요.
              <br />
              여러 개 선택하셔도 됩니다.
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            {concernOptions02.map((item) => {
              const selected = concerns.includes(item.title);

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleConcernClick(item.title)}
                  className={`group w-full rounded-2xl border px-5 py-5 text-left transition active:scale-[0.99] ${
                    selected
                      ? "border-[#10b981] bg-[#f6fffb] shadow-[0_12px_28px_rgba(16,185,129,0.14)]"
                      : "border-[#d9e7e1] bg-white hover:border-[#9fd5c1] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-[1px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[15px] font-bold transition ${
                        selected
                          ? "border-[#10b981] bg-[#10b981] text-white shadow-[0_6px_16px_rgba(16,185,129,0.22)]"
                          : "border-gray-300 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </div>

                    <div className="min-w-0">
                      <div className="text-[16px] font-semibold leading-6 text-black">
                        {item.title}
                      </div>
                      <div className="mt-1.5 text-[14px] leading-6 text-gray-500">
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

          <div ref={leadFormRef}>
            {concerns.length > 0 && (
              <>
                <div className="mt-5 rounded-2xl border border-[#dfeee7] bg-[#f8faf9] px-4 py-4">
                  <div className="text-center text-[14px] font-medium leading-6 text-gray-700">
                    선택하신 내용으로 상담 안내가 진행됩니다.
                  </div>

                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {concerns.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[#10b981] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#047857]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <TopLeadForm
                  name={name}
                  phone={phone}
                  agreed={agreed}
                  submitting={submitting}
                  submitError={submitError}
                  submitInfo={submitInfo}
                  setName={setName}
                  setPhone={setPhone}
                  setAgreed={setAgreed}
                  handleSubmit={handleSubmit}
                  handleFormStarted={handleFormStarted}
                />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-8">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-6 text-center">
            <p className="text-[13px] font-semibold tracking-[0.12em] text-[#0f766e]">
              BEFORE & AFTER SHORTS
            </p>
            <h2 className="mt-2 text-[24px] font-bold leading-tight text-black">
              같은 고민 사례를
              <br />
              짧은 영상으로 먼저 확인해보세요
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-gray-600">
              실제 전후 느낌을 빠르게 보고 상담 여부를 결정하실 수 있습니다.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.10)]">
              <div className="px-4 pt-4">
                <p className="text-[14px] font-semibold text-black">
                  눈밑지방재배치 사례 1
                </p>
                <p className="mt-1 text-[13px] leading-5 text-gray-600">
                  첫 번째 쇼츠 사례를 확인해보세요.
                </p>
              </div>

              <div className="px-4 pb-4 pt-3">
                <div className="mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-2xl bg-black">
                  <iframe
                    src="https://www.youtube.com/embed/-qNI_oVCev4?autoplay=1&mute=1&playsinline=1&rel=0"
                    title="눈밑지방재배치 쇼츠 1"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.10)]">
              <div className="px-4 pt-4">
                <p className="text-[14px] font-semibold text-black">
                  눈밑지방재배치 사례 2
                </p>
                <p className="mt-1 text-[13px] leading-5 text-gray-600">
                  두 번째 쇼츠 사례도 함께 비교해보세요.
                </p>
              </div>

              <div className="px-4 pb-4 pt-3">
                <div className="mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-2xl bg-black">
                  <iframe
                    src="https://www.youtube.com/embed/g5TzGxqmEvc?autoplay=1&mute=1&playsinline=1&rel=0"
                    title="눈밑지방재배치 쇼츠 2"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InlineCTA text="상담 신청하기" onClick={onOpenForm} />

      <section>
        <img
          src="/intro/02/02.jpg"
          alt="02 랜딩 하단"
          className="block w-full"
          draggable={false}
        />
      </section>

      <InlineCTA text="상담 신청하기" onClick={onOpenForm} />
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
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");

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

  function clearFormMessages() {
    setSubmitError("");
    setSubmitInfo("");
  }

  function handleFormStarted() {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackFormStart(getTrackingPayload());
  }

  function openFormWithTracking(location: string) {
    trackCTA(location, getTrackingPayload());
    clearFormMessages();
    setOpen(true);
  }

  useEffect(() => {
    trackLandingView(getTrackingPayload());

    const onScroll = () => {
      const currentTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollHeight = document.documentElement.scrollHeight;

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

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [config.key, config.hospitalName, pathname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (submitting) return;

    clearFormMessages();

    const cleanName = name.trim();
    const cleanPhone = normalizePhone(phone);

    if (!cleanName) {
      setSubmitError("이름을 입력해주세요.");
      return;
    }

    if (!isValidPhone(phone)) {
      setSubmitError("전화번호를 정확히 입력해주세요.");
      return;
    }

    if (!agreed) {
      setSubmitError("개인정보 수집 및 이용 동의가 필요합니다.");
      return;
    }

    setSubmitting(true);
    setSubmitInfo("상담 신청을 접수하고 있습니다.");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 10000);

    const eventId = generateEventId();

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
        signal: controller.signal,
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          landing_key: config.key,
          concerns: isLanding02 ? concerns02 : [],
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          utm_term: utm.utm_term,
          utm_content: utm.utm_content,
          utm,
          event_id: eventId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "상담 신청 중 오류가 발생했습니다.");
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

        setSubmitError("이미 접수된 상담 정보입니다.");
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

      trackLeadComplete({
        landing_key: config.key,
        content_name: `landing_${config.key}`,
        eventID: eventId,
        name: cleanName,
        phone: cleanPhone,
      });

      clearFormMessages();
      setSuccessOpen(true);
      setName("");
      setPhone("");
      setAgreed(false);
      setConcerns02([]);
      setOpen(false);
      formStartedRef.current = false;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setSubmitError("응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setSubmitError(error?.message || "전송 실패. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitInfo("");
      setSubmitting(false);
    }
  }

  return (
    <>
      <main className="min-h-[100dvh] bg-white">
        {config.key === "00" && (
          <div
            className="fixed left-4 top-4 z-40 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <img
              src="/logo.png"
              alt="비엔파트너스"
              className="h-12 object-contain drop-shadow-lg lg:h-20"
            />
          </div>
        )}

        <div className="grid min-h-[100dvh] w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 pb-24 lg:pb-0">
            {isLanding02 ? (
              <Landing02Content
                concerns={concerns02}
                toggleConcern={toggleConcern02}
                onOpenForm={() => openFormWithTracking("inline_cta")}
                name={name}
                phone={phone}
                agreed={agreed}
                submitting={submitting}
                submitError={submitError}
                submitInfo={submitInfo}
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
                      className={isSingleLongImage ? "w-full" : "min-h-[100dvh] w-full"}
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
                            : "block min-h-[100dvh] w-full bg-white object-contain"
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

          <aside className="hidden border-l border-gray-200 bg-[#f8f8f8] lg:block">
            <div className="sticky top-0 h-[100dvh] p-6">
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

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                    {isLanding02 && <RequiredVisitNotice compact />}

                    <input
                      className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                      placeholder="이름을 입력해주세요"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={handleFormStarted}
                      disabled={submitting}
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
                      disabled={submitting}
                      required
                    />

                    <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-black">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 accent-black"
                        disabled={submitting}
                      />
                      <span className="font-medium text-gray-800">
                        개인정보 수집 및 이용에 동의합니다
                      </span>
                    </label>

                    <div className="rounded-xl bg-[#f8faf9] px-4 py-3 text-center text-[13px] leading-5 text-gray-600">
                      입력해주신 정보는 상담 안내 외 다른 용도로 사용되지 않습니다.
                    </div>

                    <FormMessage submitError={submitError} submitInfo={submitInfo} />

                    <button
                      type="submit"
                      disabled={submitting}
                      aria-busy={submitting}
                      className="mt-1 h-12 rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "전송 중..." : "상담 신청하기"}
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

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white p-3 lg:hidden">
          <button
            type="button"
            onClick={() => openFormWithTracking("mobile_sticky")}
            className="h-12 w-full rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm"
          >
            상담 신청하기
          </button>
        </div>

        {open && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/60 lg:items-center lg:justify-center lg:p-4"
            onClick={() => !submitting && setOpen(false)}
          >
            <div
              className="w-full rounded-t-2xl bg-white p-6 shadow-2xl lg:max-w-md lg:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {isLanding02 && <RequiredVisitNotice compact />}

                <input
                  placeholder="이름을 입력해주세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={handleFormStarted}
                  disabled={submitting}
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                />

                <input
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  onFocus={handleFormStarted}
                  inputMode="numeric"
                  maxLength={13}
                  disabled={submitting}
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] font-medium text-black placeholder:text-gray-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                />

                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-black">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-black"
                    disabled={submitting}
                  />
                  <span className="font-medium text-gray-800">
                    개인정보 수집 및 이용에 동의합니다
                  </span>
                </label>

                <div className="rounded-xl bg-[#f8faf9] px-4 py-3 text-center text-[13px] leading-5 text-gray-600">
                  상담 안내 외 다른 용도로 사용되지 않습니다.
                </div>

                <FormMessage submitError={submitError} submitInfo={submitInfo} />

                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className="h-12 w-full rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "전송 중..." : "상담 신청하기"}
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
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