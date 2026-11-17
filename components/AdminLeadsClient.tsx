"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  memo: string | null;
  landing_key: string | null;
  utm_source?: string | null;
  assigned_to?: string | null;
  reservation_date?: string | null;
  reservation_time?: string | null;
  reservation_memo?: string | null;
  reservation_status?: string | null;
};

type Account = {
  admin_id: string;
  landing_key: string;
  balance: number;
  price_per_lead: number;
  is_active: boolean;
  updated_at?: string | null;
};

type PermissionRow = {
  admin_id: string;
  landing_key: string;
};

type ViewSetting = {
  admin_id: string;
  default_landing_key: string;
  show_combined_leads: boolean;
  show_landing_compare: boolean;
  can_edit_allowed_leads: boolean;
  updated_at?: string | null;
};

type LeadManager = {
  id: string;
  owner_landing_key: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

const LK_KEYS = Array.from({ length: 21 }, (_, i) => String(i).padStart(2, "0"));

const LANDING_LABELS: Record<string, string> = {
  "02": "눈밑",
  "03": "첫코",
  "04": "자가늑코끝성형",
  "05": "윤석호 코재수술",
  "06": "눈썹거상",
  "07": "기능코",
  "08": "비개방 코성형",
  "09": "일본 코수술",
  "10": "브이타이팅",
  "11": "수능",
};

function getLandingDisplayName(landingKey: string) {
  const lk = normalizeLK(landingKey);
  const label = LANDING_LABELS[lk];
  if (lk === "11") return "11수능";
  return label ? `${lk} ${label}` : lk;
}

const STATUS_OPTIONS = ["NEW", "BOOKED", "CALLED", "NO_ANSWER", "INVALID"] as const;
type StatusKey = typeof STATUS_OPTIONS[number];
type StatusFilter = "ALL" | StatusKey;
type ManagerFilter = "ALL" | "UNASSIGNED" | string;
type ReservationStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
type LeadDraft = {
  status?: string;
  memo?: string;
  assigned_to?: string | null;
  reservation_date?: string | null;
  reservation_time?: string | null;
  reservation_memo?: string | null;
  reservation_status?: ReservationStatus | null;
};

// 예약 시간은 09:00부터 21:00까지 30분 간격으로 선택합니다.
const RESERVATION_TIME_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const hour = 9 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

const RESERVATION_LABELS: Record<ReservationStatus, string> = {
  SCHEDULED: "예약",
  COMPLETED: "완료",
  CANCELLED: "취소",
  NO_SHOW: "부도",
};

function fieldChanged(l: Lead, d: LeadDraft) {
  return (Object.keys(d) as (keyof LeadDraft)[]).some(
    (key) => d[key] !== undefined && (d[key] ?? null) !== ((l as any)[key] ?? null)
  );
}

function hasReservationFields(lead: Lead, draft: LeadDraft) {
  // 리드 상태가 예약일 때만 예약 입력창을 보여줍니다.
  // 예약 데이터가 남아 있어도 신규 등 다른 상태에서는 표시하지 않습니다.
  return (draft.status ?? lead.status ?? "NEW") === "BOOKED";
}

function leadStatusDraft(status: string): LeadDraft {
  if (status === "NEW") {
    // 예약에서 신규로 되돌릴 때 예약관리 달력에서도 제외되도록
    // 서버로 전달할 예약 필드를 모두 null로 초기화합니다.
    return {
      status,
      reservation_date: null,
      reservation_time: null,
      reservation_status: null,
      reservation_memo: null,
    };
  }
  return { status };
}

function ReservationFields({
  lead,
  draft,
  onChange,
}: {
  lead: Lead;
  draft: LeadDraft;
  onChange: (value: LeadDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = draft.reservation_date !== undefined ? draft.reservation_date : lead.reservation_date;
  const time = draft.reservation_time !== undefined ? draft.reservation_time : lead.reservation_time;
  const reservationStatus = draft.reservation_status !== undefined
    ? draft.reservation_status : lead.reservation_status;

  if (!hasReservationFields(lead, draft)) return <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>;

  const shortDate = date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : "날짜 미정";
  const shortTime = time ? time.slice(0, 5) : "시간 미정";
  const statusLabel = RESERVATION_LABELS[(reservationStatus || "SCHEDULED") as ReservationStatus] || "예약";
  const controlStyle: React.CSSProperties = {
    ...inp, height: 38, width: "100%", minWidth: 0,
    boxSizing: "border-box", fontSize: 14, background: "#fff",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="예약 날짜·시간·진행 상태 편집"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          gap: 4, width: "100%", maxWidth: 208, minHeight: 32,
          border: "1px solid #a7f3d0", borderRadius: 8,
          background: "#f0fdf4", color: "#065f46", fontSize: 11,
          fontWeight: 700, whiteSpace: "nowrap", padding: "4px 6px",
          cursor: "pointer", boxSizing: "border-box",
        }}
      >
        <span>{shortDate} {shortTime} · {statusLabel}</span>
        <span aria-hidden="true">✎</span>
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,.48)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="예약정보 수정" style={{
            background: "#fff", color: "#111827", width: "100%", maxWidth: 440,
            padding: 20, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.2)",
            boxSizing: "border-box", whiteSpace: "normal",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 17 }}>예약정보 수정 · {lead.name || "환자"}</strong>
              <button type="button" onClick={() => setOpen(false)} style={{ ...smallBtn, fontSize: 16 }} aria-label="닫기">×</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700 }}>
                예약 날짜
                <input type="date" aria-label="예약 날짜" value={date || ""}
                  onChange={(e) => onChange({ reservation_date: e.target.value || null })} style={controlStyle} />
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700 }}>
                예약 시간
                <select aria-label="예약 시간" value={(time || "").slice(0, 5)}
                  onChange={(e) => onChange({ reservation_time: e.target.value || null })} style={controlStyle}>
                  <option value="">시간 선택</option>
                  {time && !RESERVATION_TIME_OPTIONS.includes(time.slice(0, 5)) && (
                    <option value={time.slice(0, 5)}>{time.slice(0, 5)} (기존)</option>
                  )}
                  {RESERVATION_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700 }}>
                진행 상태
                <select aria-label="예약 진행 상태" value={reservationStatus || "SCHEDULED"}
                  onChange={(e) => onChange({ reservation_status: e.target.value as ReservationStatus })} style={controlStyle}>
                  {(Object.keys(RESERVATION_LABELS) as ReservationStatus[]).map((k) => (
                    <option key={k} value={k}>{RESERVATION_LABELS[k]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
              변경한 내용은 리드 목록의 ‘저장’ 버튼을 눌러야 실제 반영됩니다.
            </div>
            <button type="button" onClick={() => setOpen(false)} style={{
              ...blackBtn, marginTop: 14, width: "100%", height: 40, fontWeight: 800,
            }}>입력 완료</button>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS_META: Record<StatusKey, { label: string; bg: string; fg: string; bd: string }> = {
  NEW: { label: "신규", bg: "#EEF2FF", fg: "#3730A3", bd: "#C7D2FE" },
  BOOKED: { label: "예약", bg: "#ECFDF5", fg: "#065F46", bd: "#A7F3D0" },
  CALLED: { label: "통화", bg: "#ECFEFF", fg: "#155E75", bd: "#A5F3FC" },
  NO_ANSWER: { label: "부재", bg: "#FEF9C3", fg: "#854D0E", bd: "#FDE68A" },
  INVALID: { label: "불량", bg: "#FEF2F2", fg: "#991B1B", bd: "#FECACA" },
};

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function extractLKFromPath(pathname: string) {
  const m = pathname.match(/^\/(\d{1,2})(\/|$)/);
  return normalizeLK(m?.[1] ?? "00");
}

function getManagerOwnerLK(userLK: string, selectedLK: string) {
  if (userLK !== "00") return userLK;

  const lk = normalizeLK(selectedLK);

  // 현재 02 어드민이 02/03/04/05/06/07/08/09를 통합 관리하므로 담당자도 02 기준으로 묶음
  if (["02", "03", "04", "05", "06", "07", "08", "09", "11"].includes(lk)) return "02";

  return lk;
}

function fmt(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("ko-KR");
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function countToday(rows: Lead[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  return rows.filter((r) => {
    const dt = new Date(r.created_at);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  }).length;
}

function countMonth(rows: Lead[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return rows.filter((r) => {
    const dt = new Date(r.created_at);
    return dt.getFullYear() === y && dt.getMonth() === m;
  }).length;
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (String(status ?? "NEW").toUpperCase() as StatusKey) || "NEW";
  const m = STATUS_META[key] ?? STATUS_META.NEW;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: m.bg,
        color: m.fg,
        border: `1px solid ${m.bd}`,
      }}
    >
      {m.label}
    </span>
  );
}

function LandingBadge({ landingKey }: { landingKey: string | null }) {
  const lk = normalizeLK(landingKey ?? "");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: lk === "03" ? "#FFF7ED" : "#F0FDFA",
        color: lk === "03" ? "#9A3412" : "#0F766E",
        border: lk === "03" ? "1px solid #FED7AA" : "1px solid #99F6E4",
      }}
    >
      {getLandingDisplayName(lk)}
    </span>
  );
}

function getSourceLabel(source?: string | null) {
  const raw = String(source || "").trim();
  const s = raw.toLowerCase();

  if (!raw) return "-";

  if (s.includes("meta") || s.includes("facebook") || s.includes("instagram")) {
    return "메타";
  }

  if (s.includes("karrot") || s.includes("daangn") || s.includes("danggeun")) {
    return "당근";
  }

  if (s.includes("naver")) {
    return "네이버";
  }

  if (s.includes("tiktok")) {
    return "틱톡";
  }

  if (s.includes("google")) {
    return "구글";
  }

  return raw;
}

function SourceBadge({ source }: { source?: string | null }) {
  const label = getSourceLabel(source);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: "#F3F4F6",
        color: "#111",
        border: "1px solid #E5E7EB",
      }}
    >
      {label}
    </span>
  );
}


// 접수 기간 선택: 첫 클릭은 시작일, 두 번째 클릭은 종료일.
// 날짜 범위는 한국 시간 기준으로 서버에 전달합니다.
function ReceptionDateRangePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const todayPart = (type: string) => todayParts.find((part) => part.type === type)?.value ?? "";
  const today = `${todayPart("year")}-${todayPart("month")}-${todayPart("day")}`;
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => today.slice(0, 7));
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [year, month] = viewMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  function changeMonth(amount: number) {
    const d = new Date(Date.UTC(year, month - 1 + amount, 1));
    setViewMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  function chooseDay(day: number) {
    const selected = `${viewMonth}-${String(day).padStart(2, "0")}`;
    if (!choosingEnd || !start || end) {
      onChange(selected, "");
      setChoosingEnd(true);
    } else {
      onChange(selected < start ? selected : start, selected < start ? start : selected);
      setChoosingEnd(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 4, position: "relative", minWidth: 210 }}>
      <span style={{ fontSize: 12, fontWeight: 800 }}>접수 기간</span>
      <button
        type="button"
        onClick={() => { setViewMonth((start || today).slice(0, 7)); setOpen((v) => !v); }}
        aria-expanded={open}
        style={{ ...inp, height: 38, background: "#fff", color: "#111827", textAlign: "left", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        📅 {start ? `${start}${end ? ` ~ ${end}` : " ~ 종료일 선택"}` : "전체 기간 · 날짜 선택"}
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, top: "100%", right: 0, marginTop: 6, width: 310, maxWidth: "calc(100vw - 32px)", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 12, boxShadow: "0 12px 30px rgba(15,23,42,.18)", padding: 12, color: "#111827" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달" style={{ ...smallBtn, padding: "5px 11px" }}>‹</button>
            <strong style={{ fontSize: 14 }}>{year}년 {month}월</strong>
            <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달" style={{ ...smallBtn, padding: "5px 11px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
            {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
              <div key={label} style={{ textAlign: "center", fontSize: 12, color: "#64748b", padding: "5px 0" }}>{label}</div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => <span key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const value = `${viewMonth}-${String(day).padStart(2, "0")}`;
              const endpoint = value === start || value === end;
              const within = Boolean(start && end && value > start && value < end);
              return (
                <button key={day} type="button" onClick={() => chooseDay(day)}
                  aria-label={`${value} 선택`} aria-pressed={endpoint || within}
                  style={{ height: 34, borderRadius: 7, cursor: "pointer", fontWeight: endpoint ? 800 : 500,
                    border: value === today && !endpoint ? "1px solid #2563eb" : "1px solid transparent",
                    background: endpoint ? "#2563eb" : within ? "#dbeafe" : "#fff",
                    color: endpoint ? "#fff" : "#111827" }}>
                  {day}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 10, minHeight: 18 }}>
            {!start ? "시작일을 선택하세요." : !end ? "종료일을 선택하세요. (같은 날도 가능)" : `${start} ~ ${end}`}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 9 }}>
            <button type="button" style={smallBtn} onClick={() => { onChange("", ""); setChoosingEnd(false); }}>기간 초기화</button>
            <button type="button" style={blackBtn} onClick={() => setOpen(false)}>완료</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLeadsClient({
  permissionsOnly = false,
}: {
  permissionsOnly?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const sess = useSession();
  const authStatus = sess?.status;
  const session = sess?.data;

  const pageLK = useMemo(() => extractLKFromPath(pathname), [pathname]);
  const userLK = normalizeLK((session?.user as any)?.landing_key ?? "");
  // 최고관리자 기능은 URL(/00)이 아닌 실제 로그인 계정 권한으로 판별합니다.
  const isMainAdmin = userLK === "00" && (session?.user as any)?.email === "admin";
  const canSwitchAny = isMainAdmin;
  const selectedLK = normalizeLK(sp.get("landing_key") ?? pageLK);

  const [rows, setRows] = useState<Lead[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const [allowedLandingKeys, setAllowedLandingKeys] = useState<string[]>([pageLK]);

  const [draft, setDraft] = useState<Record<string, LeadDraft>>({});
  const [searchInput, setSearchInput] = useState("");
  const [rangeStartInput, setRangeStartInput] = useState("");
  const [rangeEndInput, setRangeEndInput] = useState("");
  const [phoneLast4Input, setPhoneLast4Input] = useState("");
  const [search, setSearch] = useState("");
  const [receivedStart, setReceivedStart] = useState("");
  const [receivedEnd, setReceivedEnd] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const [managers, setManagers] = useState<LeadManager[]>([]);
  const [managerFilter, setManagerFilter] = useState<ManagerFilter>("ALL");
  const [managerLoading, setManagerLoading] = useState(false);

  const [account, setAccount] = useState<Account | null>(null);
  const [integratedAccounts, setIntegratedAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<any | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<any>({
    total: 0,
    today: 0,
    month: 0,
    status_counts: {},
    manager_counts: { UNASSIGNED: 0 },
    landing_counts: {},
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [topupAdminId, setTopupAdminId] = useState("");
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [topupNote, setTopupNote] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [viewSettings, setViewSettings] = useState<ViewSetting[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const isIntegratedAdmin = !canSwitchAny && allowedLandingKeys.length > 1;
  const managerOwnerLK = getManagerOwnerLK(userLK, selectedLK);

  // 화면의 랜딩 번호만 오름차순으로 표시하며, 원본 권한 데이터는 변경하지 않습니다.
  const sortedAllowedLandingKeys = useMemo(
    () => [...allowedLandingKeys].sort((a, b) => Number(a) - Number(b)),
    [allowedLandingKeys],
  );

  const visibleKeys = useMemo(() => {
    if (canSwitchAny) return LK_KEYS;
    return sortedAllowedLandingKeys.length ? sortedAllowedLandingKeys : [pageLK];
  }, [canSwitchAny, sortedAllowedLandingKeys, pageLK]);

  const totalBalance = useMemo(() => {
    if (isIntegratedAdmin) {
      return integratedAccounts.reduce((sum, a) => sum + safeNumber(a.balance, 0), 0);
    }
    return safeNumber(account?.balance, 0);
  }, [isIntegratedAdmin, integratedAccounts, account]);

  const displayRows = rows;

  const statusCounts = summary?.status_counts || {};
  const managerCounts = summary?.manager_counts || { UNASSIGNED: 0 };
  const todayCount = safeNumber(summary?.today, 0);
  const monthCount = safeNumber(summary?.month, 0);
  const totalAllCount = safeNumber(summary?.total, totalRows);

  function setLandingKey(k: string) {
    const nk = normalizeLK(k);
    setPage(1);

    const p = new URLSearchParams(sp.toString());
    p.set("landing_key", nk);

    router.push(`/${pageLK}/admin/leads?${p.toString()}`);
    router.refresh();
  }

  function goAccountLogsPage() {
    const q = canSwitchAny ? `?landing_key=${encodeURIComponent(selectedLK)}` : "";
    router.push(`/${pageLK}/admin/account-logs${q}`);
  }

  function goManagersPage() {
    const q = canSwitchAny ? `?landing_key=${encodeURIComponent(selectedLK)}` : "";
    router.push(`/${pageLK}/admin/managers${q}`);
  }

  function goMonthlyStatsPage() {
    const q = canSwitchAny && selectedLK !== "00"
      ? `?landing_key=${encodeURIComponent(selectedLK)}`
      : "";
    router.push(`/${pageLK}/admin/stats${q}`);
  }

  function downloadLeadsCsv() {
    const p = new URLSearchParams();

    if (canSwitchAny) p.set("landing_key", selectedLK);
    if (statusFilter !== "ALL") p.set("status", statusFilter);
    if (managerFilter !== "ALL") p.set("manager", managerFilter);

    window.location.href = `/api/admin/leads/export?${p.toString()}`;
  }

  async function loadManagers(signal?: AbortSignal) {
    if (!managerOwnerLK) return;

    setManagerLoading(true);

    try {
      const res = await fetch(
        `/api/admin/managers?owner_landing_key=${encodeURIComponent(managerOwnerLK)}`,
        { cache: "no-store", signal }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setManagers([]);
        if (!signal?.aborted) {
          setErr(`${res.status} ${json?.error || "담당자 목록 불러오기 실패"}`);
        }
        return;
      }

      setManagers((json.items || []) as LeadManager[]);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setManagers([]);
        setErr("MANAGER_NETWORK_ERROR");
      }
    } finally {
      if (!signal?.aborted) setManagerLoading(false);
    }
  }

  async function saveLead(id: string) {
    const lead = rows.find((r) => r.id === id);
    if (!lead) return;
    const d = draft[id] || {};
    const body: Record<string, unknown> = { id };

    if (typeof d.status === "string") body.status = d.status;
    if (typeof d.memo === "string") body.memo = d.memo;
    if (typeof d.assigned_to !== "undefined") body.assigned_to = d.assigned_to || null;
    if (d.reservation_date !== undefined) body.reservation_date = d.reservation_date;
    if (d.reservation_time !== undefined) body.reservation_time = d.reservation_time;
    if (d.reservation_memo !== undefined) body.reservation_memo = d.reservation_memo;
    if (d.reservation_status !== undefined) body.reservation_status = d.reservation_status;
    if (d.status === "NEW") {
      body.reservation_date = null;
      body.reservation_time = null;
      body.reservation_status = null;
      body.reservation_memo = null;
    }
    if (Object.keys(body).length === 1) return;

    const finalStatus = d.status ?? lead.status ?? "NEW";
    const finalDate = d.reservation_date !== undefined ? d.reservation_date : lead.reservation_date;
    if (finalStatus === "BOOKED" && !finalDate &&
        (d.status === "BOOKED" || d.reservation_date !== undefined)) {
      alert("예약으로 변경할 때 예약 날짜를 반드시 입력해주세요.");
      return;
    }

    setSaving((m) => ({ ...m, [id]: true }));
    setErr(null);

    try {
      const res = await fetch(`/api/admin/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "error"}`);
        return;
      }

      const item: Lead | undefined = json?.item;
      if (item?.id) {
        setRows((prev) => prev.map((r) => (r.id === item.id ? item : r)));
      }

      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      setErr("NETWORK_ERROR");
    } finally {
      setSaving((m) => ({ ...m, [id]: false }));
    }
  }

  async function deleteLead(id: string) {
    if (!isMainAdmin) return;

    const ok = window.confirm("이 리드를 삭제하시겠습니까?");
    if (!ok) return;

    setDeleting((m) => ({ ...m, [id]: true }));
    setErr(null);

    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "error"}`);
        return;
      }

      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      setErr("NETWORK_ERROR");
    } finally {
      setDeleting((m) => ({ ...m, [id]: false }));
    }
  }

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    setManagerFilter("ALL");

    const ac = new AbortController();
    loadManagers(ac.signal);

    return () => ac.abort();
  }, [authStatus, managerOwnerLK]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/${pageLK}/admin/login`);
      return;
    }

    if (authStatus !== "authenticated") return;

    const ac = new AbortController();

    (async () => {
      setErr(null);
      setLoadingRows(true);

      try {
        if (!canSwitchAny) {
          const leadParams = new URLSearchParams({
            page: String(page),
            page_size: String(pageSize),
          });
          if (statusFilter !== "ALL") leadParams.set("status", statusFilter);
          if (managerFilter !== "ALL") leadParams.set("manager", managerFilter);
          if (search) leadParams.set("search", search);
          if (receivedStart && receivedEnd) {
            leadParams.set("start_date", receivedStart);
            leadParams.set("end_date", receivedEnd);
          }
          if (phoneLast4) leadParams.set("phone_last4", phoneLast4);

          const leadsRes = await fetch(`/api/admin/leads?${leadParams.toString()}`, {
            cache: "no-store",
            signal: ac.signal,
          });

          const leadsJson = await leadsRes.json().catch(() => ({}));

          if (!leadsRes.ok) {
            setErr(`${leadsRes.status} ${leadsJson?.error || "error"}`);
            setRows([]);
            setAllowedLandingKeys([pageLK]);
            return;
          }

          const keys: string[] = Array.isArray(leadsJson.allowed_landing_keys)
            ? leadsJson.allowed_landing_keys.map((v: any) => normalizeLK(v))
            : [pageLK];

          const uniqueKeys: string[] = Array.from(
            new Set<string>(keys.length ? keys : [pageLK])
          );

          setAllowedLandingKeys(uniqueKeys);
          setRows((leadsJson.items || leadsJson.data || []) as Lead[]);
          setTotalRows(safeNumber(leadsJson.total, 0));
          setTotalPages(Math.max(1, safeNumber(leadsJson.total_pages, 1)));
          setSummary(leadsJson.summary || {});
          setDraft({});
          setStats(null);

          const accountResults = await Promise.all(
            uniqueKeys.map((lk) =>
              fetch(`/api/admin/accounts?landing_key=${encodeURIComponent(lk)}`, {
                cache: "no-store",
                signal: ac.signal,
              }).then(async (res) => ({
                res,
                json: await res.json().catch(() => ({})),
              }))
            )
          );

          const mergedAccounts: Account[] = [];
          for (const item of accountResults) {
            if (item.res.ok && item.json?.item) {
              mergedAccounts.push(item.json.item as Account);
            }
          }

          setIntegratedAccounts(mergedAccounts);
          setAccount(mergedAccounts[0] || null);
          return;
        }

        const [leadsRes, statsRes, accRes] = await Promise.all([
          fetch(`/api/admin/leads?${new URLSearchParams({
            landing_key: selectedLK,
            page: String(page),
            page_size: String(pageSize),
            ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
            ...(managerFilter !== "ALL" ? { manager: managerFilter } : {}),
            ...(search ? { search } : {}),
            ...(receivedStart && receivedEnd ? { start_date: receivedStart, end_date: receivedEnd } : {}),
            ...(phoneLast4 ? { phone_last4: phoneLast4 } : {}),
          }).toString()}`, {
            cache: "no-store",
            signal: ac.signal,
          }),
          fetch(`/api/admin/stats?landing_key=${encodeURIComponent(selectedLK)}`, {
            cache: "no-store",
            signal: ac.signal,
          }),
          fetch(`/api/admin/accounts?landing_key=${encodeURIComponent(selectedLK)}`, {
            cache: "no-store",
            signal: ac.signal,
          }),
        ]);

        const leadsJson = await leadsRes.json().catch(() => ({}));
        const statsJson = await statsRes.json().catch(() => ({}));
        const accJson = await accRes.json().catch(() => ({}));

        if (!leadsRes.ok) {
          setErr(`${leadsRes.status} ${leadsJson?.error || "error"}`);
          setRows([]);
        } else {
          setRows((leadsJson.items || leadsJson.data || []) as Lead[]);
          setTotalRows(safeNumber(leadsJson.total, 0));
          setTotalPages(Math.max(1, safeNumber(leadsJson.total_pages, 1)));
          setSummary(leadsJson.summary || {});
          setDraft({});
        }

        setAllowedLandingKeys([selectedLK]);
        setStats(statsRes.ok ? statsJson : null);
        setAccount(accRes.ok ? ((accJson.item || null) as Account | null) : null);
        setIntegratedAccounts([]);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setErr("NETWORK_ERROR");
          setRows([]);
          setStats(null);
          setAccount(null);
          setIntegratedAccounts([]);
        }
      } finally {
        setLoadingRows(false);
      }
    })();

    return () => ac.abort();
  }, [
    authStatus,
    router,
    selectedLK,
    pageLK,
    canSwitchAny,
    page,
    pageSize,
    statusFilter,
    managerFilter,
    search,
    receivedStart,
    receivedEnd,
    phoneLast4,
  ]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (!isMainAdmin) return;

    const ac = new AbortController();

    (async () => {
      setAccountsLoading(true);

      try {
        const res = await fetch("/api/admin/accounts", {
          cache: "no-store",
          signal: ac.signal,
        });

        const json = await res.json().catch(() => ({}));
        if (res.ok) setAccounts((json.items || []) as Account[]);
      } catch {
      } finally {
        setAccountsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [authStatus, isMainAdmin]);

  async function refreshAccountsList() {
    if (!isMainAdmin) return;

    const res = await fetch("/api/admin/accounts", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    if (res.ok) setAccounts((json.items || []) as Account[]);
  }

  async function refreshPermissions() {
    if (!isMainAdmin) return;

    setPermissionsLoading(true);

    try {
      const res = await fetch("/api/admin/permissions", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "권한 목록 불러오기 실패"}`);
        return;
      }

      setPermissions((json.permissions || []) as PermissionRow[]);
      setViewSettings((json.settings || []) as ViewSetting[]);
    } finally {
      setPermissionsLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (!isMainAdmin) return;
    refreshPermissions();
  }, [authStatus, isMainAdmin]);

  async function doTopup() {
    if (!isMainAdmin) return;

    const admin_id = topupAdminId.trim();
    const amount = safeNumber(topupAmount, 0);
    const note = topupNote.trim();

    if (!admin_id || amount <= 0) {
      alert("admin_id / 금액 입력");
      return;
    }

    setTopupLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/accounts/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id, amount, note }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "충전 실패");
        return;
      }

      alert("충전 완료");
      setTopupAdminId("");
      setTopupAmount(0);
      setTopupNote("");

      await refreshAccountsList();
    } finally {
      setTopupLoading(false);
    }
  }

  async function saveAccountSetting(
    admin_id: string,
    landing_key: string,
    price_per_lead: number,
    is_active: boolean
  ) {
    if (!isMainAdmin) return;

    const res = await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_id, landing_key, price_per_lead, is_active }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "저장 실패");
      return;
    }

    await refreshAccountsList();
  }

  async function changePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("현재 비밀번호와 새 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (newPassword.length < 8) {
      alert("새 비밀번호는 8자 이상으로 입력해주세요.");
      return;
    }

    if (newPassword.length > 72) {
      alert("새 비밀번호는 72자 이하로 입력해주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (currentPassword === newPassword) {
      alert("새 비밀번호는 현재 비밀번호와 다르게 입력해주세요.");
      return;
    }

    setChangePasswordLoading(true);

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json?.error === "INVALID_CURRENT_PASSWORD") {
          alert("현재 비밀번호가 올바르지 않습니다.");
          return;
        }

        if (json?.error === "ACCOUNT_NOT_FOUND") {
          alert("관리자 계정 정보를 찾을 수 없습니다.");
          return;
        }

        alert(json?.error || "비밀번호 변경에 실패했습니다.");
        return;
      }

      alert("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);

      await signOut({ callbackUrl: `/${pageLK}/admin/login` });
    } catch (e) {
      console.error(e);
      alert("네트워크 오류로 비밀번호 변경에 실패했습니다.");
    } finally {
      setChangePasswordLoading(false);
    }
  }

  if (!authStatus || authStatus === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  if (permissionsOnly) {
    if (
      !isMainAdmin
    ) {
      return <div style={{ padding: 24 }}>?? ??? ????.</div>;
    }

    return (
      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/00/admin/leads")}
          style={smallBtn}
        >← 리드 관리로 돌아가기</button>

        <h1 style={{ marginTop: 24, fontSize: 24, fontWeight: 900 }}>어드민 권한 설정</h1>

        <RootPermissionsBox
          accounts={accounts}
          permissions={permissions}
          viewSettings={viewSettings}
          loading={permissionsLoading}
          onRefresh={refreshPermissions}
        />
      </div>
    );
  }

  return (
    <div className="admin-leads-root" style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>

      <style>{`
        .admin-leads-root {
          background: #ffffff;
          color: #111827;
          min-height: 100vh;
          box-sizing: border-box;
          color-scheme: light;
        }

        .admin-leads-root input,
        .admin-leads-root select,
        .admin-leads-root textarea {
          color: #111827;
          background-color: #ffffff;
          color-scheme: light;
        }

        .admin-leads-root button {
          color-scheme: light;
        }


        .admin-mobile-leads {
          display: none;
        }

        @media (max-width: 767px) {
          .admin-leads-table-scroll {
            display: none !important;
          }

          .admin-mobile-leads {
            display: block;
            margin-top: 16px;
          }

          .admin-mobile-lead-card {
            background: #fff;
            color: #111827;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 12px;
            overflow-wrap: anywhere;
          }

          .admin-mobile-lead-heading {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
          }

          .admin-mobile-lead-details {
            display: grid;
            gap: 10px;
            margin: 14px 0;
            font-size: 13px;
            color: #475569;
          }

          .admin-mobile-lead-fields {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .admin-mobile-lead-fields label,
          .admin-mobile-memo {
            display: grid;
            gap: 6px;
            min-width: 0;
            font-size: 13px;
            font-weight: 700;
          }

          .admin-mobile-lead-fields select,
          .admin-mobile-memo textarea {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #fff;
            color: #111827;
            font-size: 14px;
          }

          .admin-mobile-memo {
            margin-top: 14px;
          }

          .admin-mobile-save,
          .admin-mobile-delete {
            width: 100%;
            padding: 12px;
            margin-top: 12px;
            border: 0;
            border-radius: 9px;
            font-weight: 800;
            background: #2563eb;
            color: #fff;
          }

          .admin-mobile-save:disabled {
            background: #e5e7eb;
            color: #6b7280;
          }

          .admin-mobile-delete {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
          }
        }

        .admin-leads-table-scroll table {
          min-width: 1000px;
          table-layout: auto;
        }

        /* 랜딩·유입·예약정보의 좌우 여백을 줄여 메모 열의 공간을 확보 */
        .admin-leads-table-scroll th,
        .admin-leads-table-scroll td {
          white-space: nowrap;
          padding-left: 5px !important;
          padding-right: 5px !important;
        }
        .admin-leads-table-scroll th:first-child,
        .admin-leads-table-scroll td:first-child {
          padding-left: 9px !important;
        }
        .admin-leads-table-scroll th:last-child,
        .admin-leads-table-scroll td:last-child {
          padding-right: 9px !important;
        }

        .admin-leads-table-scroll textarea {
          white-space: pre-wrap;
        }

        @media (max-width: 767px) {
          .admin-leads-root {
            padding: 14px !important;
            width: 100%;
            overflow-x: hidden;
          }

          .admin-leads-top {
            flex-direction: column;
            align-items: stretch !important;
            gap: 16px !important;
          }

          .admin-leads-top > div {
            min-width: 0;
          }

          .admin-leads-top > div:last-child {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
          }

          .admin-leads-top > div:last-child button {
            width: 100%;
            min-width: 0;
            padding: 10px 5px !important;
            font-size: 13px;
          }

          .admin-leads-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .admin-leads-root-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .admin-leads-metrics > div,
          .admin-leads-root-metrics > div {
            min-width: 0;
            overflow-wrap: anywhere;
            font-size: 13px;
          }

          .admin-leads-metrics > div > div,
          .admin-leads-root-metrics > div > div {
            font-size: 16px !important;
            overflow-wrap: anywhere;
          }

          .admin-leads-table-scroll {
            max-width: 100%;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }

          .admin-leads-table-scroll th,
          .admin-leads-table-scroll td {
            white-space: nowrap;
          }
        }
      `}</style>

      <div className="admin-leads-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Admin Leads</h1>

          <p style={{ opacity: 0.7, marginTop: 6, marginBottom: 0 }}>
            user: {(session?.user as any)?.email} / my_landing_key: {userLK || "-"} / page_lk: {pageLK}
          </p>

          {isIntegratedAdmin && (
            <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 800, color: "#0f766e" }}>
              통합 관리: {sortedAllowedLandingKeys.join(" + ")}번 리드 / 잔액 합산 표시
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={goMonthlyStatsPage}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            월별 통계
          </button>

          <button
            type="button"
            onClick={() => router.push(`/${pageLK}/admin/reservations${canSwitchAny && selectedLK !== "00" ? `?landing_key=${encodeURIComponent(selectedLK)}` : ""}`)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #0f766e",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            예약관리
          </button>

          {isMainAdmin && (
            <button
              type="button"
              onClick={() => router.push("/00/admin/accounts")}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #7c3aed", background: "#7c3aed", color: "#fff", fontWeight: 800, cursor: "pointer" }}
            >
              충전 / 단가 관리
            </button>
          )}

          {isMainAdmin && (
            <button
              onClick={() => router.push("/00/admin/permissions")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#374151",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              어드민 권한 설정
            </button>
          )}

          <button
            onClick={goAccountLogsPage}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            잔액 히스토리
          </button>

          <button
            onClick={goManagersPage}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            담당자 관리
          </button>

          {isMainAdmin && (
          <button
            onClick={downloadLeadsCsv}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            엑셀 다운로드
          </button>
          )}

          <button
            onClick={() => setChangePasswordOpen(true)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            비밀번호 변경
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

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visibleKeys.map((k) => (
          <button
            key={k}
            onClick={() => setLandingKey(k)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              fontWeight: k === selectedLK || (!canSwitchAny && allowedLandingKeys.includes(k)) ? 900 : 600,
              background: k === selectedLK || (!canSwitchAny && allowedLandingKeys.includes(k)) ? "#111" : "#fff",
              color: k === selectedLK || (!canSwitchAny && allowedLandingKeys.includes(k)) ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {getLandingDisplayName(k)}
          </button>
        ))}
      </div>

      <div
        className="admin-leads-metrics"
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: isIntegratedAdmin
            ? `repeat(${Math.min(7, Math.max(4, allowedLandingKeys.length + 3))}, minmax(0, 1fr))`
            : "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div style={card}>
          {isIntegratedAdmin ? "통합 잔액" : "잔액"}
          <div style={cardBig}>{fmt(totalBalance)}</div>
        </div>

        {isIntegratedAdmin ? (
          <>
            {sortedAllowedLandingKeys.map((lk) => {
              const acc = integratedAccounts.find((a) => normalizeLK(a.landing_key) === lk);
              const chargeAccount02 = integratedAccounts.find(
                (a) => normalizeLK(a.landing_key) === "02",
              );
              const leadSummary = summary?.landing_counts?.[lk] || { today: 0, month: 0, total: 0 };
              const displayPrice =
                acc?.price_per_lead ??
                (["08", "11"].includes(lk) ? chargeAccount02?.price_per_lead : undefined);

              return (
                <div key={lk} style={card}>
                  {getLandingDisplayName(lk)} 리드
                  <div style={cardBig}>
                    오늘 {fmt(leadSummary.today)} / 월 {fmt(leadSummary.month)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                    단가 {fmt(displayPrice)}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div style={card}>
            리드 단가
            <div style={cardBig}>{fmt(account?.price_per_lead)}</div>
          </div>
        )}

        <div style={card}>
          오늘 리드
          <div style={cardBig}>{fmt(stats?.counts?.today ?? todayCount)}</div>
        </div>

        <div style={card}>
          이번달 리드
          <div style={cardBig}>{fmt(stats?.counts?.month ?? monthCount)}</div>
        </div>
      </div>

      {isMainAdmin && (
        <div className="admin-leads-root-metrics" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div style={card}>
            전체 오늘 리드
            <div style={cardBig}>{fmt(todayCount)}</div>
          </div>

          <div style={card}>
            전체 이번달 리드
            <div style={cardBig}>{fmt(monthCount)}</div>
          </div>

          <div style={card}>
            전체 누적 리드
            <div style={cardBig}>{fmt(totalAllCount)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["ALL", ...STATUS_OPTIONS] as const).map((s) => {
          const active = statusFilter === (s as any);
          const label = s === "ALL" ? "전체" : STATUS_META[s].label;
          const count = s === "ALL" ? totalAllCount : statusCounts?.[s] ?? 0;

          return (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s as StatusFilter);
                setPage(1);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                fontWeight: active ? 900 : 600,
                background: active ? "#111" : "#fff",
                color: active ? "#fff" : "#111",
                cursor: "pointer",
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong>담당자</strong>

        <select
          value={managerFilter}
          onChange={(e) => {
            setManagerFilter(e.target.value);
            setPage(1);
          }}
          style={{
            height: 36,
            padding: "0 10px",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <option value="ALL">전체 ({totalAllCount})</option>
          <option value="UNASSIGNED">미지정 ({managerCounts.UNASSIGNED || 0})</option>

          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {!m.active ? " (비활성)" : ""} ({managerCounts[m.id] || 0})
            </option>
          ))}
        </select>

        {managerLoading && <span style={{ fontSize: 13, color: "#666" }}>담당자 불러오는 중...</span>}
      </div>

       <form
         onSubmit={(e) => {
           e.preventDefault();
           if (rangeStartInput && !rangeEndInput) {
             alert("접수 기간의 종료일도 선택해주세요.");
             return;
           }
           setPage(1);
           if (phoneLast4Input && !/^\d{4}$/.test(phoneLast4Input)) {
             alert("전화번호 뒷자리는 숫자 4개를 입력해주세요.");
             return;
           }
           setSearch(searchInput.trim());
           setReceivedStart(rangeStartInput);
           setReceivedEnd(rangeEndInput);
           setPhoneLast4(phoneLast4Input);
         }}
         style={{ marginTop: 10, display: "flex", alignItems: "end", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}
       >
         <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 800 }}>
           환자 이름
           <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
             placeholder="환자 이름" style={{ ...inp, width: 170 }} />
         </label>
         <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 800 }}>
           전화번호 뒷자리
           <input inputMode="numeric" maxLength={4} value={phoneLast4Input}
             onChange={(e) => setPhoneLast4Input(e.target.value.replace(/\D/g, "").slice(0, 4))}
             placeholder="4자리 (선택)" style={{ ...inp, width: 120 }} />
         </label>
         <ReceptionDateRangePicker start={rangeStartInput} end={rangeEndInput}
           onChange={(start, end) => { setRangeStartInput(start); setRangeEndInput(end); }} />
         <button type="submit" style={{ ...blackBtn, height: 38 }}>검색</button>
         <button type="button" style={{ ...smallBtn, height: 38 }} onClick={() => {
           setSearchInput("");
           setRangeStartInput("");
           setRangeEndInput("");
           setPhoneLast4Input("");
           setSearch("");
           setReceivedStart("");
           setReceivedEnd("");
           setPhoneLast4("");
           setPage(1);
         }}>초기화</button>
       </form>

      {err && <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</p>}

      {/* Mobile-only lead cards */}
      <div className="admin-mobile-leads">
        <div style={{ fontWeight: 900, marginBottom: 12 }}>
          {"\uCD5C\uADFC \uC0C1\uB2F4 \uB9AC\uB4DC"}
          {" "}({fmt(totalRows)})
        </div>

        {displayRows.map((l) => {
          const d = draft[l.id] || {};
          const curStatus = (d.status ?? l.status ?? "NEW") as StatusKey;
          const curMemo = d.memo ?? l.memo ?? "";
          const curAssignedTo =
            d.assigned_to !== undefined
              ? d.assigned_to
              : l.assigned_to || "";

          const changed = fieldChanged(l, d);

          return (
            <div key={l.id} className="admin-mobile-lead-card">
              <div className="admin-mobile-lead-heading">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 900 }}>
                    {l.name || "-"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <LandingBadge landingKey={l.landing_key} />
                  </div>
                </div>
                <StatusBadge status={curStatus} />
              </div>

              <div className="admin-mobile-lead-details">
                <div>
                  {new Date(l.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </div>
                <div>
                  <SourceBadge source={l.utm_source} />
                </div>
                <a
                  href={`tel:${String(l.phone || "").replace(/[^\d+]/g, "")}`}
                  style={{ color: "#2563eb", fontWeight: 800 }}
                >
                  {l.phone || "-"}
                </a>
              </div>

              <div className="admin-mobile-lead-fields">
                <label>
                  <span>{"\uC0C1\uB2F4 \uC0C1\uD0DC"}</span>
                  <select
                    value={curStatus}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [l.id]: {
                          ...prev[l.id],
                          ...leadStatusDraft(e.target.value),
                        },
                      }))
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{"\uB2F4\uB2F9\uC790"}</span>
                  <select
                    value={curAssignedTo || ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [l.id]: {
                          ...prev[l.id],
                          assigned_to: e.target.value || null,
                        },
                      }))
                    }
                  >
                    <option value="">
                      {"\uBBF8\uC9C0\uC815"}
                    </option>
                    {managers
                      .filter(
                        (m) =>
                          m.active ||
                          m.id === l.assigned_to ||
                          m.id === curAssignedTo
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {!m.active ? " (inactive)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {hasReservationFields(l, d) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>예약정보</div>
                  <ReservationFields lead={l} draft={d} onChange={(change) =>
                    setDraft((prev) => ({ ...prev, [l.id]: { ...prev[l.id], ...change } }))
                  } />
                </div>
              )}

              <label className="admin-mobile-memo">
                <span>{"\uC0C1\uB2F4 \uBA54\uBAA8"}</span>
                <textarea
                  rows={3}
                  value={curMemo}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [l.id]: {
                        ...prev[l.id],
                        memo: e.target.value,
                      },
                    }))
                  }
                />
              </label>

              <button
                type="button"
                className="admin-mobile-save"
                disabled={!changed || !!saving[l.id]}
                onClick={() => saveLead(l.id)}
              >
                {saving[l.id]
                  ? "\uC800\uC7A5\uC911..."
                  : "\uBCC0\uACBD\uC0AC\uD56D \uC800\uC7A5"}
              </button>

              {isMainAdmin && (
                <button
                  type="button"
                  className="admin-mobile-delete"
                  disabled={!!deleting[l.id]}
                  onClick={() => deleteLead(l.id)}
                >
                  {"\uB9AC\uB4DC \uC0AD\uC81C"}
                </button>
              )}
            </div>
          );
        })}

        {!loadingRows && displayRows.length === 0 && (
          <p>{"\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</p>
        )}
      </div>

      <div className="admin-leads-table-scroll" style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, overflowX: "auto" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 800 }}>
          {isIntegratedAdmin
            ? `${sortedAllowedLandingKeys.join(" + ")} 통합 • ${loadingRows ? "불러오는 중..." : `전체 ${totalRows}건 / ${page}페이지`}`
            : `${selectedLK} • ${loadingRows ? "불러오는 중..." : `전체 ${totalRows}건 / ${page}페이지`}`}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>시간</th>
              <th style={th}>랜딩</th>
              <th style={th}>유입</th>
              <th style={th}>이름</th>
              <th style={th}>전화</th>
              <th style={th}>상태</th>
              <th style={th}>예약정보</th>
              <th style={th}>담당자</th>
              <th style={th}>메모 / 저장</th>
              {isMainAdmin && <th style={th}>삭제</th>}
            </tr>
          </thead>

          <tbody>
            {displayRows.map((l) => {
              const d = draft[l.id] || {};
              const curStatus = (d.status ?? l.status ?? "NEW") as StatusKey;
              const curMemo = (d.memo ?? l.memo ?? "") as string;
              const curAssignedTo = d.assigned_to !== undefined ? d.assigned_to : l.assigned_to || "";

              const changed = fieldChanged(l, d);

              return (
                <Fragment key={l.id}>
                <tr>
                  <td style={{ ...tdTop, minWidth: 95, fontSize: 12, lineHeight: 1.5 }}>
                    <div>{new Date(l.created_at).toLocaleDateString("ko-KR")}</div>
                    <div>{new Date(l.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td style={{ ...tdTop, paddingLeft: 3, paddingRight: 3 }}><LandingBadge landingKey={l.landing_key} /></td>
                  <td style={{ ...tdTop, paddingLeft: 3, paddingRight: 3 }}><SourceBadge source={l.utm_source} /></td>
                  <td style={tdTop}>{l.name ?? "-"}</td>
                  <td style={tdTop}>{l.phone ?? "-"}</td>

                  <td style={tdTop}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <StatusBadge status={curStatus} />

                      <select
                        value={curStatus}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [l.id]: { ...prev[l.id], ...leadStatusDraft(e.target.value) },
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  <td style={{ ...tdTop, minWidth: 198, width: 208, whiteSpace: "nowrap" }}>
                    <ReservationFields lead={l} draft={d} onChange={(change) =>
                      setDraft((prev) => ({ ...prev, [l.id]: { ...prev[l.id], ...change } }))
                    } />
                  </td>

                  <td style={tdTop}>
                    <select
                      value={curAssignedTo || ""}
                      onChange={(e) => {
                        const value = e.target.value || null;

                        setDraft((prev) => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], assigned_to: value },
                        }));
                      }}
                      style={{
                        width: 112,
                        height: 34,
                        padding: "0 8px",
                        border: "1px solid #ddd",
                        borderRadius: 10,
                        background: "#fff",
                      }}
                    >
                      <option value="">미지정</option>

                      {managers
                        .filter((m) => m.active || m.id === l.assigned_to || m.id === curAssignedTo)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {!m.active ? " (비활성)" : ""}
                          </option>
                        ))}
                    </select>
                  </td>

                  <td style={{ ...tdTop, minWidth: 245, width: "29%" }}>
                    <div style={{ display: "flex", alignItems: "stretch", gap: 6, width: "100%" }}>
                      <textarea
                        value={curMemo}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [l.id]: { ...prev[l.id], memo: e.target.value },
                          }))
                        }
                        placeholder="메모"
                        rows={3}
                        style={{
                          flex: "1 1 0",
                          width: 0,
                          minWidth: 0,
                          boxSizing: "border-box",
                          minHeight: 76,
                          resize: "vertical",
                          padding: "8px 9px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          fontSize: 13,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "break-word",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveLead(l.id)}
                        disabled={!changed || !!saving[l.id]}
                        style={{
                          flex: "0 0 54px",
                          alignSelf: "stretch",
                          padding: "0 6px",
                          borderRadius: 10,
                          border: changed ? "1px solid #111" : "1px solid #d1d5db",
                          background: changed ? "#111" : "#f3f4f6",
                          color: changed ? "#fff" : "#6b7280",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: changed && !saving[l.id] ? "pointer" : "not-allowed",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {saving[l.id] ? "저장중" : "저장"}
                      </button>
                    </div>
                  </td>

                  {isMainAdmin && (
                    <td style={tdTop}>
                      <button
                        onClick={() => deleteLead(l.id)}
                        disabled={!!deleting[l.id]}
                        style={{
                          display: "block",
                          width: 54,
                          minHeight: 76,
                          padding: "0 6px",
                          borderRadius: 10,
                          border: "1px solid #f1c0c0",
                          background: "#fff5f5",
                          color: "#b91c1c",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: deleting[l.id] ? "not-allowed" : "pointer",
                        }}
                      >
                        {deleting[l.id] ? "삭제중..." : "삭제"}
                      </button>
                    </td>
                  )}
                </tr>
                </Fragment>
              );
            })}

            {!loadingRows && displayRows.length === 0 && (
              <tr>
                <td colSpan={isMainAdmin ? 10 : 9} style={{ padding: 14, color: "#666" }}>
                  데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, color: "#555" }}>
          전체 {fmt(totalRows)}건 · {page} / {totalPages}페이지
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{ height: 36, border: "1px solid #ddd", borderRadius: 10, padding: "0 8px" }}
          >
            <option value={25}>25개씩</option>
            <option value={50}>50개씩</option>
            <option value={100}>100개씩</option>
          </select>

          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loadingRows}
            style={smallBtn}
          >
            이전
          </button>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loadingRows}
            style={smallBtn}
          >
            다음
          </button>
        </div>
      </div>

      {changePasswordOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !changePasswordLoading) {
              setChangePasswordOpen(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>비밀번호 변경</h3>
                <div style={{ marginTop: 5, fontSize: 13, color: "#666" }}>
                  {(session?.user as any)?.email}
                </div>
              </div>

              <button
                type="button"
                disabled={changePasswordLoading}
                onClick={() => setChangePasswordOpen(false)}
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: changePasswordLoading ? "not-allowed" : "pointer",
                  color: "#666",
                }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>현재 비밀번호</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={changePasswordLoading}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>새 비밀번호</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changePasswordLoading}
                  placeholder="8자 이상"
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>새 비밀번호 확인</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !changePasswordLoading) {
                      changePassword();
                    }
                  }}
                  disabled={changePasswordLoading}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setChangePasswordOpen(false)}
                disabled={changePasswordLoading}
                style={smallBtn}
              >
                취소
              </button>

              <button
                type="button"
                onClick={changePassword}
                disabled={changePasswordLoading}
                style={{
                  ...blackBtn,
                  opacity: changePasswordLoading ? 0.6 : 1,
                  cursor: changePasswordLoading ? "not-allowed" : "pointer",
                }}
              >
                {changePasswordLoading ? "변경중..." : "변경하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RootPermissionsBox({
  accounts,
  permissions,
  viewSettings,
  loading,
  onRefresh,
}: {
  accounts: Account[];
  permissions: PermissionRow[];
  viewSettings: ViewSetting[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const adminIds = useMemo(() => {
    return Array.from(
      new Set(accounts.map((a) => a.admin_id).filter((id) => id && id !== "admin"))
    ).sort();
  }, [accounts]);

  return (
    <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ margin: 0, fontWeight: 900 }}>Root: 어드민 권한 설정</h3>

        <button onClick={onRefresh} style={smallBtn}>
          {loading ? "불러오는 중..." : "권한 새로고침"}
        </button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        {adminIds.map((adminId) => {
          const allowed = permissions
            .filter((p) => p.admin_id === adminId)
            .map((p) => normalizeLK(p.landing_key));

          const setting = viewSettings.find((s) => s.admin_id === adminId);

          return (
            <PermissionEditor
              key={adminId}
              adminId={adminId}
              initialLandingKeys={allowed.length ? allowed : [normalizeLK(adminId.replace("admin", ""))]}
              initialSetting={setting}
              onSaved={onRefresh}
            />
          );
        })}

        {adminIds.length === 0 && (
          <div style={{ padding: 12, color: "#666" }}>
            계정이 없습니다. 먼저 accounts에 admin02/admin03 계정이 있어야 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionEditor({
  adminId,
  initialLandingKeys,
  initialSetting,
  onSaved,
}: {
  adminId: string;
  initialLandingKeys: string[];
  initialSetting?: ViewSetting;
  onSaved: () => Promise<void>;
}) {
  const fallbackLK = normalizeLK(adminId.replace("admin", ""));
  const initialKeys = Array.from(new Set(initialLandingKeys.length ? initialLandingKeys : [fallbackLK]));

  const [landingKeys, setLandingKeys] = useState<string[]>(initialKeys);
  const [defaultLK, setDefaultLK] = useState(normalizeLK(initialSetting?.default_landing_key ?? initialKeys[0] ?? fallbackLK));
  const [showCombined, setShowCombined] = useState(!!initialSetting?.show_combined_leads);
  const [showCompare, setShowCompare] = useState(initialSetting?.show_landing_compare !== false);
  const [canEdit, setCanEdit] = useState(initialSetting?.can_edit_allowed_leads !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const keys = Array.from(new Set(initialLandingKeys.length ? initialLandingKeys : [fallbackLK]));
    setLandingKeys(keys);
    setDefaultLK(normalizeLK(initialSetting?.default_landing_key ?? keys[0] ?? fallbackLK));
    setShowCombined(!!initialSetting?.show_combined_leads);
    setShowCompare(initialSetting?.show_landing_compare !== false);
    setCanEdit(initialSetting?.can_edit_allowed_leads !== false);
  }, [initialLandingKeys.join(","), initialSetting?.admin_id, initialSetting?.updated_at]);

  function toggleLK(lk: string) {
    setLandingKeys((prev) => {
      const exists = prev.includes(lk);
      const next = exists ? prev.filter((x) => x !== lk) : [...prev, lk].sort();

      if (next.length === 0) return prev;
      if (!next.includes(defaultLK)) setDefaultLK(next[0]);

      return next;
    });
  }

  async function save() {
    if (!landingKeys.includes(defaultLK)) {
      alert("기본 랜딩은 접근 가능 랜딩에 포함되어야 합니다.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: adminId,
          landing_keys: landingKeys,
          default_landing_key: defaultLK,
          show_combined_leads: showCombined,
          show_landing_compare: showCompare,
          can_edit_allowed_leads: canEdit,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json?.error || "권한 저장 실패");
        return;
      }

      alert("권한 저장 완료");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <strong>{adminId}</strong>

        <button onClick={save} disabled={saving} style={blackBtn}>
          {saving ? "저장중..." : "권한 저장"}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>접근 가능 랜딩</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LK_KEYS.filter((k) => k !== "00").map((lk) => (
            <label
              key={lk}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: landingKeys.includes(lk) ? "1px solid #111" : "1px solid #ddd",
                background: landingKeys.includes(lk) ? "#111" : "#fff",
                color: landingKeys.includes(lk) ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              <input
                type="checkbox"
                checked={landingKeys.includes(lk)}
                onChange={() => toggleLK(lk)}
              />
              {lk}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 900 }}>기본 랜딩</span>

        <select value={defaultLK} onChange={(e) => setDefaultLK(normalizeLK(e.target.value))}>
          {landingKeys.map((lk) => (
            <option key={lk} value={lk}>
              {lk}
            </option>
          ))}
        </select>

        <label style={checkLabel}>
          <input type="checkbox" checked={showCombined} onChange={(e) => setShowCombined(e.target.checked)} />
          통합 리드 표시
        </label>

        <label style={checkLabel}>
          <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} />
          랜딩별 비교 카드 표시
        </label>

        <label style={checkLabel}>
          <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
          허용 랜딩 수정 가능
        </label>
      </div>
    </div>
  );
}

function AccountRow({
  a,
  onSave,
}: {
  a: Account;
  onSave: (admin_id: string, landing_key: string, price_per_lead: number, is_active: boolean) => Promise<void>;
}) {
  const [price, setPrice] = useState<number>(safeNumber(a.price_per_lead, 0));
  const [active, setActive] = useState<boolean>(!!a.is_active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(safeNumber(a.price_per_lead, 0));
    setActive(!!a.is_active);
  }, [a.price_per_lead, a.is_active]);

  return (
    <tr>
      <td style={td}>{a.admin_id}</td>
      <td style={td}>{a.landing_key}</td>
      <td style={td}>{fmt(a.balance)}</td>

      <td style={td}>
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: 120 }} />
      </td>

      <td style={td}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </td>

      <td style={td}>
        <button
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(a.admin_id, a.landing_key, safeNumber(price, 0), active);
            } finally {
              setSaving(false);
            }
          }}
          style={smallBtn}
          disabled={saving}
        >
          {saving ? "저장중..." : "저장"}
        </button>
      </td>
    </tr>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
};

const cardBig: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  marginTop: 6,
};

const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
};

const blackBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

const checkLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #eee",
  fontSize: 13,
  color: "#444",
  background: "#fafafa",
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f3f3f3",
  fontSize: 14,
};

const tdTop: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f3f3f3",
  fontSize: 14,
  verticalAlign: "top",
};
