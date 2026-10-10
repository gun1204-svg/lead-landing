import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = {
  email?: string | null;
  landing_key?: string | null;
};

const STATUS_KEYS = ["NEW", "BOOKED", "CALLED", "NO_ANSWER", "INVALID"] as const;
const STATUS_LABEL: Record<string, string> = {
  NEW: "신규",
  BOOKED: "예약",
  CALLED: "통화",
  NO_ANSWER: "부재",
  INVALID: "불량",
};

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

function normalizeStatus(v: unknown) {
  const s = String(v ?? "").trim().toUpperCase();
  return STATUS_KEYS.includes(s as (typeof STATUS_KEYS)[number]) ? s : null;
}

function csvCell(v: unknown) {
  const s = String(v ?? "").replace(/\r?\n/g, " ").trim();
  return `"${s.replace(/"/g, '""')}"`;
}

function sourceLabel(source: unknown) {
  const raw = String(source ?? "").trim();
  const s = raw.toLowerCase();
  if (!raw) return "-";
  if (s.includes("meta") || s.includes("facebook") || s.includes("instagram")) return "메타";
  if (s.includes("karrot") || s.includes("daangn") || s.includes("danggeun")) return "당근";
  if (s.includes("naver")) return "네이버";
  if (s.includes("tiktok")) return "틱톡";
  if (s.includes("google")) return "구글";
  return raw;
}

async function getAllowedLandingKeys(adminId: string, userLK: string) {
  if (userLK === "00") return null;

  const { data, error } = await supabaseAdmin
    .from("admin_landing_permissions")
    .select("landing_key")
    .eq("admin_id", adminId);

  if (error) throw error;

  const keys = (data ?? [])
    .map((row) => normalizeLandingKey(row.landing_key))
    .filter(Boolean) as string[];

  return Array.from(new Set(keys.length ? keys : [userLK]));
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  const sessionAdminId = String(user?.email ?? "").trim();

  if (!sessionAdminId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);
  if (!userLK) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestedLK = normalizeLandingKey(searchParams.get("landing_key"));
  const status = normalizeStatus(searchParams.get("status"));
  const manager = String(searchParams.get("manager") ?? "").trim();

  const permissionAdminId = userLK === "00" ? "admin" : `admin${userLK}`;
  const allowedKeys = await getAllowedLandingKeys(permissionAdminId, userLK);

  if (userLK !== "00" && requestedLK && !allowedKeys?.includes(requestedLK)) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const managersRes = await supabaseAdmin.from("lead_managers").select("id,name");
  const managerMap = new Map<string, string>();
  if (!managersRes.error) {
    for (const m of managersRes.data ?? []) managerMap.set(String(m.id), String(m.name));
  }

  const batchSize = 1000;
  let from = 0;
  const allRows: any[] = [];

  while (true) {
    let q = supabaseAdmin
      .from("leads")
      .select("created_at,landing_key,utm_source,name,phone,status,assigned_to,memo")
      .order("created_at", { ascending: false })
      .range(from, from + batchSize - 1);

    if (userLK === "00") {
      if (requestedLK && requestedLK !== "00") q = q.eq("landing_key", requestedLK);
    } else if (requestedLK) {
      q = q.eq("landing_key", requestedLK);
    } else {
      q = q.in("landing_key", allowedKeys ?? [userLK]);
    }

    if (status) q = q.eq("status", status);
    if (manager === "UNASSIGNED") q = q.is("assigned_to", null);
    else if (manager) q = q.eq("assigned_to", manager);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const batch = data ?? [];
    allRows.push(...batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  const header = ["접수시간", "랜딩", "유입", "이름", "전화", "상태", "담당자", "메모"];
  const lines = allRows.map((lead) => [
    new Date(lead.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    `${normalizeLandingKey(lead.landing_key) ?? "00"}번`,
    sourceLabel(lead.utm_source),
    lead.name || "-",
    lead.phone || "-",
    STATUS_LABEL[String(lead.status ?? "NEW").toUpperCase()] || lead.status || "-",
    lead.assigned_to ? managerMap.get(String(lead.assigned_to)) || "담당자 없음" : "미지정",
    lead.memo || "",
  ]);

  const csv = "\uFEFF" + [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  const keyText = requestedLK || (allowedKeys?.join("-") ?? "all");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads_${keyText}_${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}