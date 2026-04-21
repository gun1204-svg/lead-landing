export type LandingConfig = {
  key: string;
  hospitalName: string;
  title: string;
  description: string;
  introPath: string;
  submitLabel: string;
  mobileSubmitLabel?: string;
  pageCount?: number;
  telegramChatId?: string;

  businessName?: string;
  address?: string;
  businessNumber?: string;
  representativeName?: string;
  phone?: string;
  privacyManager?: string;
  privacyContact?: string;
  privacyEmail?: string;
};

export const LANDING_CONFIG: Record<string, LandingConfig> = {
  "00": {
    key: "00",
    hospitalName: "비엔파트너스",
    title: "실제 문의 사례 기반",
    description: "병원 신규 상담 문의를 만드는 방법을 안내드립니다",
    introPath: "/intro/00",
    submitLabel: "문의 사례 받아보기",
    mobileSubmitLabel: "문의 사례 받아보기",
    pageCount: 10,
    telegramChatId: process.env.TELEGRAM_CHAT_ID_00,

    businessName: "비엔파트너스",
    address: "서울시 성동구 성수동2가 280 SK V1 CENTER 1-1611",
    businessNumber: "114-16-48944",
    representativeName: "최건",
    phone: "010-3703-1068",
    privacyManager: "비엔파트너스",
    privacyContact: "010-3703-1068",
    privacyEmail: "bienpartner@naver.com",
  },

  "01": {
    key: "01",
    hospitalName: "01병원",
    title: "성형외과 상담 신청",
    description: "병원에서 상담 전화 드립니다",
    introPath: "/intro/01",
    submitLabel: "상담 받기",
    mobileSubmitLabel: "상담 받기",
    pageCount: 1,
    telegramChatId: process.env.TELEGRAM_CHAT_ID_01,

    businessName: "01병원",
    address: "서울시 강남구",
    businessNumber: "111-11-11111",
    representativeName: "대표자명",
    phone: "02-1111-2222",
    privacyManager: "01병원",
    privacyContact: "02-1111-2222",
    privacyEmail: "contact@hospital01.com",
  },

  "02": {
    key: "02",
    hospitalName: "미호성형외과의원",
    title: "미호성형외과 상담 신청",
    description: "지금 바로 상담 받아보세요",
    introPath: "/intro/02",
    submitLabel: "상담 받기",
    mobileSubmitLabel: "상담 받기",
    pageCount: 1,
    telegramChatId: process.env.TELEGRAM_CHAT_ID_02,

    businessName: "미호성형외과의원",
    address:
      "서울시 강남구 강남대로 492 HM타워 7,8,9층 (신논현역 3번출구 도보 3분)",
    businessNumber: "848-79-00072",
    representativeName: "윤석호",
    phone: "02-595-5503",
    privacyManager: "미호성형외과의원",
    privacyContact: "02-595-5503",
    privacyEmail: "",
  },

  "03": {
    key: "03",
    hospitalName: "미호성형외과의원",
    title: "미호성형외과 코수술 상담 신청",
    description: "코 라인과 분위기 변화를 상담해보세요",
    introPath: "/intro/03",
    submitLabel: "상담 신청하기",
    mobileSubmitLabel: "상담 신청하기",
    pageCount: 1,
    telegramChatId: process.env.TELEGRAM_CHAT_ID_02,

    businessName: "미호성형외과의원",
    address:
      "서울시 강남구 강남대로 492 HM타워 7,8,9층 (신논현역 3번출구 도보 3분)",
    businessNumber: "848-79-00072",
    representativeName: "윤석호",
    phone: "02-595-5503",
    privacyManager: "미호성형외과의원",
    privacyContact: "02-595-5503",
    privacyEmail: "",
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