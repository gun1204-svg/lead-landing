export type LandingConfig = {
  key: string;
  title: string;
  description: string;
  introPath: string;
  submitLabel: string;
  mobileSubmitLabel?: string;
  pageCount?: number;
};

export const LANDING_CONFIG: Record<string, LandingConfig> = {
  "00": {
    key: "00",
    title: "실제 문의 사례 기반",
    description: "병원 신규 상담 문의를 만드는 방법을 안내드립니다",
    introPath: "/intro/00",
    submitLabel: "문의 사례 받아보기",
    mobileSubmitLabel: "문의 사례 받아보기",
    pageCount: 10,
  },
  "01": {
    key: "01",
    title: "성형외과 상담 신청",
    description: "병원에서 상담 전화 드립니다",
    introPath: "/intro/01",
    submitLabel: "상담 받기",
    mobileSubmitLabel: "상담 받기",
    pageCount: 1,
  },
  "02": {
    key: "02",
    title: "실제 문의 사례 기반",
    description: "병원 신규 상담 문의를 만드는 방법을 안내드립니다",
    introPath: "/intro/02",
    submitLabel: "맘카페 문의 사례 받아보기",
    mobileSubmitLabel: "맘카페 문의 사례 받아보기",
    pageCount: 10,
  },
};

export function normalizeLK(value?: string) {
  const s = String(value ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export function getLandingConfig(value?: string): LandingConfig {
  const lk = normalizeLK(value);
  return LANDING_CONFIG[lk] ?? LANDING_CONFIG["00"];
}