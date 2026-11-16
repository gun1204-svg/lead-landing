"use client";

import { useRouter } from "next/navigation";

type Props = {
  pageLK: string;
  landingKey?: string;
};

/** 관리자 하위 페이지 상단에 공통으로 사용하는 돌아가기 버튼 */
export default function BackToLeadsButton({ pageLK, landingKey }: Props) {
  const router = useRouter();
  const suffix = landingKey && landingKey !== "ALL"
    ? `?landing_key=${encodeURIComponent(landingKey)}`
    : "";

  return (
    <button
      type="button"
      onClick={() => router.push(`/${pageLK}/admin/leads${suffix}`)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 36,
        padding: "8px 12px",
        border: "1px solid #d1d5db",
        borderRadius: 9,
        background: "#fff",
        color: "#111827",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.25,
        cursor: "pointer",
      }}
    >
      ← 리드 관리로 돌아가기
    </button>
  );
}
