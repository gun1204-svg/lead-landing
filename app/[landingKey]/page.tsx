import type { Metadata } from "next";
import LandingClient from "@/components/LandingClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ landingKey: string }>;
};

function normalizeLandingKey(v: string) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function getLandingSeo(lk: string) {
  const baseUrl = "https://bienptns.com";

  const fallbackImage = `${baseUrl}/intro/${lk}/01.jpg`;
  const ogImage = `${baseUrl}/og/${lk}.jpg`;

  if (lk === "04") {
    return {
      title: "코재수술 상담",
      description:
        "실패한 원인을 정확히 분석하여 마지막 코수술이 되도록!",
      keywords: [
        "코재수술 상담",
        "코재수술",
        "코성형 재수술",
        "코끝 재수술",
        "보형물 재수술",
        "휜 코 재수술",
        "코 비대칭 상담",
      ],
      ogTitle: "코재수술 상담",
      ogDescription:
        "코수술 후 코 모양, 코끝, 보형물, 비대칭 고민이 있다면 지금 상담 신청",
      image: ogImage,
      fallbackImage,
    };
  }

  if (lk === "03") {
    return {
      title: "코수술 상담",
      description:
        "낮은 콧대, 퍼진 코, 휜 코, 옆라인 고민이 있으신가요?",
      keywords: [
        "코수술 상담",
        "코성형 상담",
        "낮은 콧대 상담",
        "휜 코 상담",
        "코라인 상담",
      ],
      ogTitle: "코수술 상담",
      ogDescription:
        "코 라인, 콧대, 비대칭 고민이 있다면 지금 상담 신청",
      image: ogImage,
      fallbackImage,
    };
  }

  if (lk === "02") {
    return {
      title: "눈밑지방재배치 상담",
      description:
        "눈밑지방, 다크서클, 처짐 고민 있으신가요? 지금 상담 신청하고 개선 가능 여부를 확인해보세요.",
      keywords: [
        "눈밑지방재배치",
        "다크서클 상담",
        "눈밑처짐 상담",
        "눈밑지방",
        "눈밑성형",
      ],
      ogTitle: "눈밑지방재배치 상담",
      ogDescription:
        "다크서클, 눈밑지방, 처짐 고민이 있다면 지금 상담 신청하고 개선 방향을 확인해보세요.",
      image: ogImage,
      fallbackImage,
    };
  }

  if (lk === "01") {
    return {
      title: "상담 신청",
      description: "상담 신청 후 빠르게 안내드립니다.",
      keywords: ["상담 신청", "비엔파트너스"],
      ogTitle: "상담 신청",
      ogDescription: "상담 신청 후 빠르게 안내드립니다.",
      image: ogImage,
      fallbackImage,
    };
  }

  return {
    title: "비엔파트너스",
    description: "성과 중심 퍼포먼스 마케팅과 상담 랜딩 운영.",
    keywords: [
      "비엔파트너스",
      "퍼포먼스 마케팅",
      "상담 랜딩",
      "CPA 마케팅",
      "리드 수집",
    ],
    ogTitle: "비엔파트너스",
    ogDescription: "성과 중심 퍼포먼스 마케팅과 상담 랜딩 운영.",
    image: ogImage,
    fallbackImage,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { landingKey } = await params;
  const lk = normalizeLandingKey(landingKey);
  const seo = getLandingSeo(lk);
  const url = `https://bienptns.com/${lk}`;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      url,
      siteName: "비엔파트너스",
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: seo.image,
          width: 1200,
          height: 630,
          alt: seo.ogTitle,
        },
        {
          url: seo.fallbackImage,
          width: 1200,
          height: 630,
          alt: seo.ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: [seo.image, seo.fallbackImage],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { landingKey } = await params;
  return <LandingClient landingKey={landingKey} />;
}