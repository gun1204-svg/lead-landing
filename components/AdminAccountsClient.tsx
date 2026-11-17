"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Account = {
  admin_id: string;
  landing_key: string;
  balance: number;
  price_per_lead: number;
  is_active: boolean;
};

const currency = (amount: number) => Number(amount || 0).toLocaleString("ko-KR");
const landingNames: Record<string, string> = {
  "02": "눈밑", "03": "첫코", "04": "자가늑코끝성형", "05": "윤석호 코재수술",
  "06": "눈썹거상", "07": "기능코", "08": "비개방 코성형", "09": "일본 코수술",
  "10": "브이타이팅", "11": "수능",
};
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 };
const control: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: 14, background: "#fff", color: "#0f172a" };
const primary: React.CSSProperties = { background: "#0f172a", color: "#fff", border: 0, borderRadius: 9, padding: "10px 15px", fontWeight: 800, cursor: "pointer" };

function EditableAccountRow({ account, onSaved }: { account: Account; onSaved: () => Promise<void> }) {
  const [price, setPrice] = useState(String(account.price_per_lead));
  const [active, setActive] = useState(account.is_active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { setPrice(String(account.price_per_lead)); setActive(account.is_active); }, [account.price_per_lead, account.is_active]);

  async function save() {
    const value = Number(price);
    if (!Number.isSafeInteger(value) || value < 0) { setMessage("단가를 0원 이상의 정수로 입력해주세요."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: account.admin_id, landing_key: account.landing_key, price_per_lead: value, is_active: active }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `저장 실패 (${response.status})`);
      await onSaved(); setMessage("저장 완료");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장에 실패했습니다."); }
    finally { setSaving(false); }
  }

  return (
    <tr style={{ borderTop: "1px solid #e2e8f0" }}>
      <td style={{ padding: 12, fontWeight: 800 }}>{account.admin_id}</td>
      <td style={{ padding: 12, whiteSpace: "nowrap" }}>{account.landing_key} {landingNames[account.landing_key] || ""}</td>
      <td style={{ padding: 12, textAlign: "right", whiteSpace: "nowrap" }}>{currency(account.balance)}원</td>
      <td style={{ padding: 12 }}><input aria-label={`${account.admin_id} 단가`} type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...control, width: 140 }} /></td>
      <td style={{ padding: 12 }}><label style={{ display: "inline-flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {active ? "활성" : "중지"}</label></td>
      <td style={{ padding: 12 }}><button type="button" onClick={save} disabled={saving} style={{ ...primary, opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중" : "저장"}</button>{message && <div role="status" style={{ fontSize: 12, marginTop: 5, color: message === "저장 완료" ? "#047857" : "#b91c1c" }}>{message}</div>}</td>
    </tr>
  );
}

export default function AdminAccountsClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user as { email?: string | null; landing_key?: string | null } | undefined;
  const isRoot = status === "authenticated" && user?.email === "admin" && String(user?.landing_key ?? "").padStart(2, "0") === "00";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMessage, setTopupMessage] = useState("");

  const loadAccounts = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/accounts", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `계정 조회 실패 (${response.status})`);
      if (!Array.isArray(result.items)) throw new Error("계정 목록 응답 형식이 올바르지 않습니다.");
      setAccounts(result.items as Account[]);
    } catch (e) { setError(e instanceof Error ? e.message : "계정 정보를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isRoot) void loadAccounts(); }, [isRoot, loadAccounts]);

  const ids = useMemo(() => [...new Set(accounts.map((a) => a.admin_id))].filter((id) => id !== "admin").sort((a, b) => a.localeCompare(b, "en", { numeric: true })), [accounts]);
  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => a.admin_id.localeCompare(b.admin_id, "en", { numeric: true }) || a.landing_key.localeCompare(b.landing_key, "en", { numeric: true })), [accounts]);
  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0), [accounts]);

  async function topup() {
    const value = Number(amount);
    if (!selectedId) { setTopupMessage("충전할 관리자 계정을 선택해주세요."); return; }
    if (!Number.isSafeInteger(value) || value === 0) { setTopupMessage("금액은 0원을 제외한 정수로 입력해주세요. (차감은 -금액)"); return; }
    const isWithdrawal = value < 0;
    const targetAccounts = accounts.filter((a) => a.admin_id === selectedId);
    if (isWithdrawal && targetAccounts.length !== 1) { setTopupMessage("차감 계정의 잔액을 명확히 확인할 수 없습니다. 관리자 계정 정보를 확인해주세요."); return; }
    if (isWithdrawal && Number(targetAccounts[0].balance) < Math.abs(value)) { setTopupMessage("잔액보다 큰 금액은 차감할 수 없습니다."); return; }
    if (!window.confirm(isWithdrawal
      ? `${selectedId} 계정에서 ${currency(Math.abs(value))}원을 차감할까요?\n현재 잔액: ${currency(targetAccounts[0].balance)}원\n차감 후 예상 잔액: ${currency(Number(targetAccounts[0].balance) + value)}원`
      : `${selectedId} 계정에 ${currency(value)}원을 충전할까요?`)) return;
    setTopupLoading(true); setTopupMessage("");
    try {
      const response = await fetch("/api/admin/accounts/topup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: selectedId, amount: value, note: note.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `충전 실패 (${response.status})`);
      setAmount(""); setNote("");
      await loadAccounts(); setTopupMessage(`${selectedId} ${isWithdrawal ? "차감" : "충전"} 완료`);
    } catch (e) { setTopupMessage(e instanceof Error ? e.message : "충전하지 못했습니다."); }
    finally { setTopupLoading(false); }
  }

  if (status === "loading") return <div style={{ padding: 24 }}>로그인 확인 중...</div>;
  if (!isRoot) return <div style={{ padding: 24 }}>최고관리자만 접근할 수 있습니다.</div>;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: "24px 16px", colorScheme: "light" }}>
      <div style={{ maxWidth: 1150, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><h1 style={{ fontSize: 25, margin: 0 }}>충전 / 단가 관리</h1><p style={{ margin: "7px 0 0", color: "#64748b" }}>00 최고관리자 전용 · 관리자 계정별 잔액 및 단가</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => router.push("/00/admin/leads")} style={{ ...primary, background: "#fff", border: "1px solid #cbd5e1", color: "#0f172a" }}>← 리드 관리로 돌아가기</button>
            <button type="button" onClick={() => void loadAccounts()} disabled={loading} style={primary}>{loading ? "불러오는 중" : "목록 새로고침"}</button>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={panel}><span style={{ color: "#64748b", fontSize: 13 }}>등록된 관리자 계정</span><div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{ids.length}개</div></div>
          <div style={panel}><span style={{ color: "#64748b", fontSize: 13 }}>계정 행 기준 전체 잔액</span><div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{currency(totalBalance)}원</div></div>
        </div>

        {error && <div role="alert" style={{ ...panel, color: "#b91c1c" }}>{error}</div>}

        <section style={panel}>
          <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>잔액 충전 / 차감</h2>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>양수는 충전, 음수(-)는 차감입니다. 차감은 서버 API에서도 음수 금액을 허용해야 실제 반영됩니다.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13 }}>관리자 계정
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={control}><option value="">계정 선택</option>{ids.map((id) => <option key={id} value={id}>{id}</option>)}</select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13 }}>충전 / 차감 금액 (원)
              <input type="number" step={1} placeholder="충전: 350000 / 차감: -350000" value={amount} onChange={(e) => setAmount(e.target.value)} style={control}/>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13 }}>충전 메모
              <input placeholder="선택사항" value={note} onChange={(e) => setNote(e.target.value)} style={control}/>
            </label>
            <button type="button" onClick={topup} disabled={topupLoading || loading} style={{ ...primary, height: 42, opacity: topupLoading || loading ? 0.55 : 1 }}>{topupLoading ? "처리 중..." : Number(amount) < 0 ? "차감하기" : "충전하기"}</button>
          </div>
          {topupMessage && <p role="status" style={{ marginBottom: 0, fontSize: 13, color: /(충전|차감) 완료$/.test(topupMessage) ? "#047857" : "#b91c1c" }}>{topupMessage}</p>}
        </section>

        <section style={panel}>
          <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>관리자별 단가 · 활성 설정</h2>
          <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 13 }}>단가와 활성 상태를 변경한 뒤 해당 행의 저장 버튼을 눌러주세요.</p>
          {!loading && !accounts.some((a) => a.admin_id === "admin11") && <p style={{ background: "#fffbeb", color: "#92400e", borderRadius: 9, padding: 12, fontSize: 13 }}>admin11이 목록에 없습니다. Supabase admin_accounts 등록 여부와 API 응답을 확인해주세요.</p>}
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 730, fontSize: 14 }}>
              <thead><tr style={{ textAlign: "left", background: "#f1f5f9" }}><th style={{ padding: 12 }}>관리자</th><th style={{ padding: 12 }}>랜딩</th><th style={{ padding: 12, textAlign: "right" }}>잔액</th><th style={{ padding: 12 }}>리드 단가</th><th style={{ padding: 12 }}>상태</th><th style={{ padding: 12 }}>설정</th></tr></thead>
              <tbody>{sortedAccounts.map((a) => <EditableAccountRow key={`${a.admin_id}-${a.landing_key}`} account={a} onSaved={loadAccounts} />)}</tbody>
            </table>
            {!loading && sortedAccounts.length === 0 && <p style={{ textAlign: "center", color: "#64748b", padding: 20 }}>조회된 관리자 계정이 없습니다.</p>}
            {loading && <p style={{ textAlign: "center", color: "#64748b", padding: 20 }}>계정 불러오는 중...</p>}
          </div>
        </section>
        <p style={{ color: "#64748b", fontSize: 12 }}>주의: 실제 로그인 계정 생성과 랜딩별 접근 권한 설정은 이 페이지에서 처리하지 않습니다. 각 기능의 기존 설정을 이용해주세요.</p>
      </div>
    </main>
  );
}
