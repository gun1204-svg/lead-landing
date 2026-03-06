export type LandingConfig = {
  key: string;
  title: string;
  introPath: string;
  submitLabel: string;
};

export const LANDING_CONFIG: Record<string, LandingConfig> = {
  "00": {
    key: "00",
    title: "비엔파트너스 마케팅 상담",
    introPath: "/intro/00",
    submitLabel: "무료 상담 신청",
  },
  "01": {
    key: "01",
    title: "비엔파트너스 마케팅 상담",
    introPath: "/intro/01",
    submitLabel: "무료 상담 신청",
  },
  "02": {
    key: "02",
    title: "비엔파트너스 마케팅 상담",
    introPath: "/intro/02",
    submitLabel: "무료 상담 신청",
  },
};

export function normalizeLK(value?: string) {
  return String(value ?? "00").padStart(2, "0");
}

export function getLandingConfig(value?: string): LandingConfig {
  const lk = normalizeLK(value);
  return LANDING_CONFIG[lk] ?? LANDING_CONFIG["00"];
}