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

type SummaryLead = {
  created_at: string;
  status: string | null;
  landing_key: string | null;
  assigned_to: string | null;
};

const STATUS_KEYS = ["NEW", "BOOKED", "CALLED", "NO_ANSWER", "INVALID"] as const;

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

function toPositiveInt(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
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

function applyLandingScope(
  query: any,
  userLK: string,
  requestedLK: string | null,
  allowedKeys: string[] | null
) {
  if (userLK === "00") {
    if (requestedLK && requestedLK !== "00") {
      return query.eq("landing_key", requestedLK);
    }
    return query;
  }

  if (requestedLK) {
    return query.eq("landing_key", requestedLK);
  }

  return query.in("landing_key", allowedKeys ?? [userLK]);
}

async function loadSummary(
  userLK: string,
  requestedLK: string | null,
  allowedKeys: string[] | null
) {
  const batchSize = 1000;
  let from = 0;
  const rows: SummaryLead[] = [];

  while (true) {
    let q = supabaseAdmin
      .from("leads")
      .select("created_at,status,landing_key,assigned_to")
      .order("created_at", { ascending: false })
      .range(from, from + batchSize - 1);

    q = applyLandingScope(q, userLK, requestedLK, allowedKeys);

    const { data, error } = await q;
    if (error) throw error;

    const batch = (data ?? []) as SummaryLead[];
    rows.push(...batch);

    if (batch.length < batchSize) break;
    from += batchSize;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const statusCounts: Record<string, number> = {
    NEW: 0,
    BOOKED: 0,
    CALLED: 0,
    NO_ANSWER: 0,
    INVALID: 0,
  };
  const managerCounts: Record<string, number> = { UNASSIGNED: 0 };
  const landingCounts: Record<string, { total: number; today: number; month: number }> = {};

  let today = 0;
  let month = 0;

  for (const row of rows) {
    const status = normalizeStatus(row.status) ?? "NEW";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    const managerKey = row.assigned_to || "UNASSIGNED";
    managerCounts[managerKey] = (managerCounts[managerKey] ?? 0) + 1;

    const lk = normalizeLandingKey(row.landing_key) ?? "00";
    if (!landingCounts[lk]) landingCounts[lk] = { total: 0, today: 0, month: 0 };
    landingCounts[lk].total += 1;

    const createdAt = new Date(row.created_at);
    if (createdAt >= monthStart) {
      month += 1;
      landingCounts[lk].month += 1;
    }
    if (createdAt >= todayStart) {
      today += 1;
      landingCounts[lk].today += 1;
    }
  }

  return {
    total: rows.length,
    today,
    month,
    status_counts: statusCounts,
    manager_counts: managerCounts,
    landing_counts: landingCounts,
  };
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
  const page = toPositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(100, toPositiveInt(searchParams.get("page_size"), 50));
  const status = normalizeStatus(searchParams.get("status"));
  const manager = String(searchParams.get("manager") ?? "").trim();

  let allowedKeys: string[] | null;

  try {
    const permissionAdminId = userLK === "00" ? "admin" : `admin${userLK}`;
    allowedKeys = await getAllowedLandingKeys(permissionAdminId, userLK);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Permission load failed" },
      { status: 500 }
    );
  }

  if (userLK !== "00" && requestedLK && !allowedKeys?.includes(requestedLK)) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabaseAdmin
    .from("leads")
    .select(
      `
      id,
      created_at,
      name,
      phone,
      status,
      memo,
      landing_key,
      utm_source,
      assigned_to
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  q = applyLandingScope(q, userLK, requestedLK, allowedKeys);

  if (status) q = q.eq("status", status);
  if (manager === "UNASSIGNED") q = q.is("assigned_to", null);
  else if (manager) q = q.eq("assigned_to", manager);

  try {
    const [{ data, error, count }, summary] = await Promise.all([
      q,
      loadSummary(userLK, requestedLK, allowedKeys),
    ]);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const total = count ?? 0;

    return NextResponse.json({
      ok: true,
      landing_key: requestedLK ?? userLK,
      allowed_landing_keys: allowedKeys,
      items: data ?? [],
      total,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      summary,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Lead load failed" },
      { status: 500 }
    );
  }
}