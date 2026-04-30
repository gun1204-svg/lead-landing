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

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

function isMainAdmin(user: SessionUser | undefined) {
  return normalizeLK(user?.landing_key) === "00";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isMainAdmin(user)) {
    return NextResponse.json({ ok: false, error: "Only main admin" }, { status: 403 });
  }

  const [{ data: permissions, error: pErr }, { data: settings, error: sErr }] =
    await Promise.all([
      supabaseAdmin
        .from("admin_landing_permissions")
        .select("admin_id, landing_key")
        .order("admin_id", { ascending: true })
        .order("landing_key", { ascending: true }),

      supabaseAdmin
        .from("admin_view_settings")
        .select(
          "admin_id, default_landing_key, show_combined_leads, show_landing_compare, can_edit_allowed_leads, updated_at"
        )
        .order("admin_id", { ascending: true }),
    ]);

  if (pErr) {
    return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  }

  if (sErr) {
    return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    permissions: permissions ?? [],
    settings: settings ?? [],
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isMainAdmin(user)) {
    return NextResponse.json({ ok: false, error: "Only main admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const adminId = String(body?.admin_id ?? "").trim();
  const defaultLandingKey = normalizeLK(body?.default_landing_key);
  const landingKeysRaw = Array.isArray(body?.landing_keys) ? body.landing_keys : [];

  const landingKeys = Array.from(
    new Set(
      landingKeysRaw
        .map((v: unknown) => normalizeLK(v))
        .filter(Boolean) as string[]
    )
  );

  const showCombinedLeads = !!body?.show_combined_leads;
  const showLandingCompare = body?.show_landing_compare !== false;
  const canEditAllowedLeads = body?.can_edit_allowed_leads !== false;

  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Missing admin_id" }, { status: 400 });
  }

  if (!defaultLandingKey) {
    return NextResponse.json(
      { ok: false, error: "Invalid default_landing_key" },
      { status: 400 }
    );
  }

  if (landingKeys.length === 0) {
    return NextResponse.json(
      { ok: false, error: "landing_keys required" },
      { status: 400 }
    );
  }

  if (!landingKeys.includes(defaultLandingKey)) {
    return NextResponse.json(
      { ok: false, error: "default_landing_key must be included in landing_keys" },
      { status: 400 }
    );
  }

  const { error: delErr } = await supabaseAdmin
    .from("admin_landing_permissions")
    .delete()
    .eq("admin_id", adminId);

  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  const permissionRows = landingKeys.map((lk) => ({
    admin_id: adminId,
    landing_key: lk,
  }));

  const { error: insErr } = await supabaseAdmin
    .from("admin_landing_permissions")
    .insert(permissionRows);

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  const { error: setErr } = await supabaseAdmin
    .from("admin_view_settings")
    .upsert(
      {
        admin_id: adminId,
        default_landing_key: defaultLandingKey,
        show_combined_leads: showCombinedLeads,
        show_landing_compare: showLandingCompare,
        can_edit_allowed_leads: canEditAllowedLeads,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "admin_id" }
    );

  if (setErr) {
    return NextResponse.json({ ok: false, error: setErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      admin_id: adminId,
      landing_keys: landingKeys,
      default_landing_key: defaultLandingKey,
      show_combined_leads: showCombinedLeads,
      show_landing_compare: showLandingCompare,
      can_edit_allowed_leads: canEditAllowedLeads,
    },
  });
}