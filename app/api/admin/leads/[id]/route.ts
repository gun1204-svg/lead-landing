import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = {
  email?: string | null;
  landing_key?: string | null;
};

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

function normalizeStatus(v: unknown) {
  const s = String(v ?? "").trim().toUpperCase();
  const allowed = new Set(["NEW", "IN_PROGRESS", "DONE", "BLOCKED"]);
  return allowed.has(s) ? s : null;
}

function normalizeMemo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, 500);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);
  if (!userLK) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  // ✅ Next.js 타입 요구에 맞게 params는 await
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const nextStatus = normalizeStatus(body?.status);
  const nextMemo = normalizeMemo(body?.memo);

  if (nextStatus === null && nextMemo === null) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  // ✅ 리드 landing_key 권한 체크
  const { data: lead, error: gErr } = await supabaseAdmin
    .from("leads")
    .select("id, landing_key")
    .eq("id", id)
    .single();

  if (gErr) {
    return NextResponse.json({ ok: false, error: gErr.message }, { status: 404 });
  }

  const leadLK = normalizeLandingKey(lead?.landing_key) ?? null;

  if (userLK !== "00" && leadLK !== userLK) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const patch: Record<string, any> = {};
  if (nextStatus !== null) patch.status = nextStatus;
  if (nextMemo !== null) patch.memo = nextMemo;

  const { data: updated, error: uErr } = await supabaseAdmin
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("id, created_at, name, phone, status, memo, landing_key")
    .single();

  if (uErr) {
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: updated });
}