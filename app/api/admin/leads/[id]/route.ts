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
  const allowed = new Set(["NEW", "BOOKED", "CALLED", "NO_ANSWER", "INVALID"]);
  return allowed.has(s) ? s : null;
}

function normalizeMemo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, 500);
}

async function getAllowedLandingKeys(adminId: string, userLK: string) {
  if (userLK === "00") return null; // 메인 admin = 전체

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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  const adminId = user?.email;
  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);
  if (!userLK) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const nextStatus = body?.status !== undefined ? normalizeStatus(body.status) : undefined;
  const nextMemo = body?.memo !== undefined ? normalizeMemo(body.memo) : undefined;

  if (nextStatus === null) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  if (nextStatus === undefined && nextMemo === undefined) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const { data: lead, error: gErr } = await supabaseAdmin
    .from("leads")
    .select("id, landing_key")
    .eq("id", id)
    .single();

  if (gErr || !lead) {
    return NextResponse.json({ ok: false, error: gErr?.message || "Not found" }, { status: 404 });
  }

  const leadLK = normalizeLandingKey(lead.landing_key);

  if (!leadLK) {
    return NextResponse.json({ ok: false, error: "Invalid lead landing_key" }, { status: 400 });
  }

  let allowedKeys: string[] | null;

  try {
    allowedKeys = await getAllowedLandingKeys(adminId, userLK);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Permission load failed" },
      { status: 500 }
    );
  }

  const canEdit = userLK === "00" || allowedKeys?.includes(leadLK);

  if (!canEdit) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const patch: Record<string, any> = {};
  if (nextStatus !== undefined) patch.status = nextStatus;
  if (nextMemo !== undefined) patch.memo = nextMemo;

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

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);

  if (userLK !== "00") {
    return NextResponse.json(
      { ok: false, error: "Only main admin can delete" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}