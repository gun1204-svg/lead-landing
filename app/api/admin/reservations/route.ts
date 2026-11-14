import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeLK(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return /^\d{1,2}$/.test(s) ? s.padStart(2, "0") : null;
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { email?: string | null; landing_key?: string | null } | undefined;
    const adminId = String(user?.email ?? "").trim();
    const userLK = normalizeLK(user?.landing_key);
    if (!adminId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!userLK) return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ ok: false, error: "Invalid month" }, { status: 400 });
    }
    const rawLK = searchParams.get("landing_key");
    const requestedLK = rawLK ? normalizeLK(rawLK) : null;
    if (rawLK && !requestedLK) {
      return NextResponse.json({ ok: false, error: "Invalid landing_key" }, { status: 400 });
    }

    let allowed: string[] | null = null;
    if (userLK !== "00") {
      const permissionAdminId = `admin${userLK}`;
      const { data, error } = await supabaseAdmin
        .from("admin_landing_permissions")
        .select("landing_key")
        .eq("admin_id", permissionAdminId);
      if (error) throw error;
      const keys = (data ?? []).map((v) => normalizeLK(v.landing_key)).filter((v): v is string => v !== null);
      allowed = Array.from(new Set(keys.length ? keys : [userLK]));
      if (requestedLK && !allowed.includes(requestedLK)) {
        return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
      }
    }

    const rows: Record<string, unknown>[] = [];
    let from = 0;
    const size = 1000;
    while (true) {
      let q = supabaseAdmin
        .from("leads")
        .select("id,name,phone,landing_key,assigned_to,status,reservation_date,reservation_time,reservation_memo,reservation_status,created_at")
        .gte("reservation_date", `${month}-01`)
        .lt("reservation_date", nextMonth(month))
        .order("reservation_date", { ascending: true })
        .order("reservation_time", { ascending: true, nullsFirst: false })
        .range(from, from + size - 1);
      if (requestedLK && requestedLK !== "00") q = q.eq("landing_key", requestedLK);
      else if (userLK !== "00") q = q.in("landing_key", allowed ?? [userLK]);
      const { data, error } = await q;
      if (error) throw error;
      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < size) break;
      from += size;
    }
    return NextResponse.json({ ok: true, month, items: rows, total: rows.length, allowed_landing_keys: allowed });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reservation load failed" },
      { status: 500 }
    );
  }
}
