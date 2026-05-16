"use client";

import { useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BalanceHistoryCard from "@/components/BalanceHistoryCard";

const LK_KEYS = Array.from({ length: 21 }, (_, i) => String(i).padStart(2, "0"));

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function extractLKFromPath(pathname: string) {
  const m = pathname.match(/^\/(\d{1,2})(\/|$)/);
  return normalizeLK(m?.[1] ?? "00");
}

export default function AccountLogsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const sess = useSession();
  const authStatus = sess?.status;
  const session = sess?.data;

  const pageLK = useMemo(() => extractLKFromPath(pathname), [pathname]);
  const userLK = normalizeLK((session?.user as any)?.landing_key ?? "");
  const canSwitchAny = userLK === "00";

  const selectedLK = normalizeLK(sp.get("landing_key") ?? pageLK);

  const historyLandingKey = canSwitchAny ? selectedLK : undefined;

  function setLandingKey(k: string) {
    const nk = normalizeLK(k);
    router.push(`/${pageLK}/admin/account-logs?landing_key=${encodeURIComponent(nk)}`);
    router.refresh();
  }

  if (!authStatus || authStatus === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  if (authStatus === "unauthenticated") {
    router.replace(`/${pageLK}/admin/login`);
    return <div style={{ padding: 20 }}>로그인이 필요합니다.</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            잔액 변동 히스토리
          </h1>

          <p style={{ opacity: 0.7, marginTop: 6, marginBottom: 0 }}>
            user: {(session?.user as any)?.email} / my_landing_key: {userLK || "-"} / page_lk: {pageLK}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => router.push(`/${pageLK}/admin/leads${canSwitchAny ? `?landing_key=${selectedLK}` : ""}`)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            리드 목록
          </button>

          <button
            onClick={() => signOut({ callbackUrl: `/${pageLK}/admin/login` })}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {canSwitchAny && (
        <div style={{ marginTop: 14, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LK_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setLandingKey(k)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                fontWeight: k === selectedLK ? 900 : 600,
                background: k === selectedLK ? "#111" : "#fff",
                color: k === selectedLK ? "#fff" : "#111",
                cursor: "pointer",
              }}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <BalanceHistoryCard pageLK={historyLandingKey} />
    </div>
  );
}