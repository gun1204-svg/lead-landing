import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LeadRow = {
  created_at: string;
  landing_key: string | null;
  status: string | null;
  utm_source: string | null;
  assigned_to: string | null;
};
const STATUSES = ["NEW", "BOOKED", "CALLED", "NO_ANSWER", "INVALID"] as const;
const KST_OFFSET = 9 * 60 * 60 * 1000;

function normalizeLK(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return /^\d{1,2}$/.test(s) ? s.padStart(2, "0") : null;
}
function ymInKST(date: Date) {
  return new Date(date.getTime() + KST_OFFSET).toISOString().slice(0, 7);
}
function kstMonthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - KST_OFFSET).toISOString(),
    to: new Date(Date.UTC(y, m, 1) - KST_OFFSET).toISOString(),
  };
}
function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
function sourceLabel(value: string | null) {
  const s = String(value ?? "").toLowerCase().trim();
  if (!s) return "미분류";
  if (/meta|facebook|instagram|ig|fb/.test(s)) return "메타";
  if (/naver/.test(s)) return "네이버";
  if (/karrot|daangn|danggeun/.test(s)) return "당근";
  if (/google/.test(s)) return "구글";
  if (/kakao/.test(s)) return "카카오";
  if (/tiktok/.test(s)) return "틱톡";
  return s.slice(0, 40);
}

async function loadMonth(from: string, to: string, keys: string[] | null): Promise<LeadRow[]> {
  const all: LeadRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabaseAdmin.from("leads")
      .select("created_at,landing_key,status,utm_source,assigned_to")
      .gte("created_at", from).lt("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + 999);
    if (keys !== null) query = query.in("landing_key", keys);
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as LeadRow[];
    all.push(...batch);
    if (batch.length < 1000) return all;
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; landing_key?: string | null; role?: string } | undefined;
  const adminId = String(user?.email ?? "").trim();
  const userLK = normalizeLK(user?.landing_key);
  if (!adminId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!userLK || user?.role === "internal") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (adminId !== (userLK === "00" ? "admin" : `admin${userLK}`)) {
    return NextResponse.json({ ok: false, error: "Invalid admin scope" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const ym = params.get("month") ?? ymInKST(new Date());
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) || ym > ymInKST(new Date())) {
    return NextResponse.json({ ok: false, error: "Invalid month" }, { status: 400 });
  }
  const requestedRaw = params.get("landing_key") ?? "all";
  const selected = requestedRaw === "all" ? null : normalizeLK(requestedRaw);
  if (requestedRaw !== "all" && (!selected || selected === "00")) {
    return NextResponse.json({ ok: false, error: "Invalid landing_key" }, { status: 400 });
  }

  try {
    let allowed: string[] | null = null;
    if (userLK !== "00") {
      const { data, error } = await supabaseAdmin.from("admin_landing_permissions")
        .select("landing_key").eq("admin_id", adminId);
      if (error) throw error;
      const keys = (data ?? []).map(x => normalizeLK(x.landing_key)).filter((x): x is string => !!x && x !== "00");
      allowed = Array.from(new Set(keys.length ? keys : [userLK]));
    }
    if (selected && allowed && !allowed.includes(selected)) {
      return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
    }
    const scope = selected ? [selected] : allowed;
    const current = kstMonthRange(ym);
    const previous = kstMonthRange(prevMonth(ym));
    const [rows, oldRows] = await Promise.all([
      loadMonth(current.from, current.to, scope),
      loadMonth(previous.from, previous.to, scope),
    ]);

    // manager-monthly-stats-v2
    const managerIds = Array.from(
      new Set(
        rows
          .map((r) => r.assigned_to)
          .filter((id): id is string => !!id)
      )
    );

    const managerNames: Record<string, string> = {};

    for (let i = 0; i < managerIds.length; i += 100) {
      const ids = managerIds.slice(i, i + 100);

      const { data: managerData, error: managerError } =
        await supabaseAdmin
          .from("lead_managers")
          .select("id,name")
          .in("id", ids);

      if (managerError) throw managerError;

      for (const m of managerData ?? []) {
        managerNames[m.id] = m.name;
      }
    }

    const byManager: Record<
      string,
      { id: string; total: number; booked: number }
    > = {};


    // include-inactive-managers-v1
    // Include registered managers even when they have zero leads.
    let allManagersQuery = supabaseAdmin
      .from("lead_managers")
      .select("id,name,active");

    if (userLK !== "00") {
      allManagersQuery = allManagersQuery.eq(
        "owner_landing_key",
        userLK
      );
    }

    const {
      data: registeredManagers,
      error: registeredManagersError,
    } = await allManagersQuery;

    if (registeredManagersError) {
      throw registeredManagersError;
    }

    const managerActive: Record<string, boolean> = {};

    for (const manager of registeredManagers ?? []) {
      managerNames[manager.id] = manager.name;
      managerActive[manager.id] = manager.active;

      if (!byManager[manager.id]) {
        byManager[manager.id] = {
          id: manager.id,
          total: 0,
          booked: 0,
        };
      }
    }

    const perLanding: Record<string, { total: number; status: Record<string, number> }> = {};
    const byDay: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const statusCounts: Record<string, number> = Object.fromEntries(STATUSES.map(x => [x, 0]));
    for (const row of rows) {
      const lk = normalizeLK(row.landing_key) ?? "미분류";
      const status = String(row.status ?? "NEW").toUpperCase();
      const key = STATUSES.includes(status as typeof STATUSES[number]) ? status : "NEW";
      const day = new Date(new Date(row.created_at).getTime() + KST_OFFSET).toISOString().slice(0, 10);
      const source = sourceLabel(row.utm_source);
      if (!perLanding[lk]) perLanding[lk] = { total: 0, status: Object.fromEntries(STATUSES.map(x => [x, 0])) };
      perLanding[lk].total++;
      perLanding[lk].status[key]++;
      statusCounts[key]++;

      const managerId = row.assigned_to || "UNASSIGNED";

      if (!byManager[managerId]) {
        byManager[managerId] = {
          id: managerId,
          total: 0,
          booked: 0,
        };
      }

      byManager[managerId].total++;

      if (key === "BOOKED") {
        byManager[managerId].booked++;
      }

      byDay[day] = (byDay[day] ?? 0) + 1;
      bySource[source] = (bySource[source] ?? 0) + 1;
    }
    return NextResponse.json({
      ok: true, month: ym, selected_landing_key: selected, allowed_landing_keys: allowed,
      total: rows.length, previous_total: oldRows.length,
      booked: statusCounts.BOOKED,
      booking_rate: rows.length ? Math.round(statusCounts.BOOKED / rows.length * 1000) / 10 : 0,
      status_counts: statusCounts,
      by_landing: perLanding,
      by_manager: Object.values(byManager)
        .filter((row) => row.total > 0 || managerActive[row.id] !== false)
        .map((row) => ({
        ...row,
        active: managerActive[row.id] ?? null,
        name: row.id === "UNASSIGNED"
          ? "\uBBF8\uC9C0\uC815"
          : managerNames[row.id] || "\uC0AD\uC81C\uB41C \uB2F4\uB2F9\uC790",
      })),
      by_day: byDay,
      by_source: bySource,
    });
  } catch (error) {
    console.error("monthly stats error", error);
    return NextResponse.json({ ok: false, error: "Statistics load failed" }, { status: 500 });
  }
}
