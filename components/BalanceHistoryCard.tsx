"use client";

import { useCallback, useEffect, useState } from "react";

type BalanceLogItem = {
  id: string;
  admin_id: string;
  charge_landing_key: string;
  lead_landing_key: string | null;
  lead_id: string | null;
  change_type: string;
  amount: number;
  before_balance: number;
  after_balance: number;
  price_per_lead: number | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

function formatWon(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getTypeLabel(type: string, amount: number) {
  if (type === "LEAD_CHARGE") return "리드 차감";
  if (type === "LEAD_REFUND") return "리드 환불";
  if (type === "MANUAL_TOPUP") return "수동 충전";
  if (type === "MANUAL_DEDUCT") return "수동 차감";

  if (amount > 0) return "증액";
  if (amount < 0) return "차감";

  return "변동";
}

function getAmountStyle(amount: number): React.CSSProperties {
  if (amount > 0) {
    return {
      color: "#047857",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    };
  }

  if (amount < 0) {
    return {
      color: "#b91c1c",
      background: "#fef2f2",
      border: "1px solid #fecaca",
    };
  }

  return {
    color: "#374151",
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
  };
}

export default function BalanceHistoryCard({ pageLK }: { pageLK?: string }) {
  const [items, setItems] = useState<BalanceLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "30");

      if (pageLK) {
        params.set("landing_key", pageLK);
      }

      const res = await fetch(`/api/admin/account-logs?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "잔액 히스토리를 불러오지 못했습니다.");
      }

      setItems(json.items || []);
    } catch (e: any) {
      setError(e?.message || "잔액 히스토리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [pageLK]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <section
      style={{
        marginTop: 18,
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
            잔액 변동 히스토리
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            최근 차감, 충전, 환불 내역을 확인할 수 있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          style={{
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            color: "#111827",
          }}
        >
          {loading ? "불러오는 중" : "새로고침"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: 18,
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      {!error && items.length === 0 ? (
        <div
          style={{
            padding: 22,
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          아직 잔액 변동 내역이 없습니다.
        </div>
      ) : null}

      {!error && items.length > 0 ? (
        <div>
          {items.map((item) => {
            const label = getTypeLabel(item.change_type, item.amount);
            const isCrossLanding =
              item.lead_landing_key &&
              item.lead_landing_key !== item.charge_landing_key;

            return (
              <div
                key={item.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid #f3f4f6",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 7,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: "#111827",
                      }}
                    >
                      {label}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: "#374151",
                      lineHeight: 1.6,
                    }}
                  >
                    <b>{item.charge_landing_key}</b> 계정
                    {item.lead_landing_key ? (
                      <>
                        {" "}
                        / 리드 랜딩 <b>{item.lead_landing_key}</b>
                      </>
                    ) : null}
                    {isCrossLanding ? (
                      <span style={{ color: "#b45309", fontWeight: 800 }}>
                        {" "}
                        · 통합 차감
                      </span>
                    ) : null}
                    <br />
                    {item.reason || "-"}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    {item.before_balance.toLocaleString("ko-KR")}원 →{" "}
                    {item.after_balance.toLocaleString("ko-KR")}원
                    {item.price_per_lead ? (
                      <>
                        {" "}
                        / 단가 {item.price_per_lead.toLocaleString("ko-KR")}원
                      </>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    ...getAmountStyle(item.amount),
                    borderRadius: 999,
                    padding: "7px 10px",
                    fontSize: 13,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatWon(item.amount)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}