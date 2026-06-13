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

type AppSession = {
  user?: SessionUser | null;
} | null;

function getSessionLandingKey(session: AppSession) {
  return String(session?.user?.landing_key || "00");
}

function isRootAdmin(userLK: string) {
  return userLK === "00";
}

function canManageOwner(userLK: string, ownerLK: string) {
  if (isRootAdmin(userLK)) return true;
  return userLK === ownerLK;
}

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions as any)) as AppSession;

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userLK = getSessionLandingKey(session);
  const { searchParams } = new URL(req.url);

  const requestedOwnerLK =
    searchParams.get("owner_landing_key") ||
    searchParams.get("landing_key") ||
    userLK;

  const ownerLK = String(requestedOwnerLK);

  if (!canManageOwner(userLK, ownerLK)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden owner_landing_key" },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("lead_managers")
    .select("id, owner_landing_key, name, active, sort_order, created_at, updated_at")
    .eq("owner_landing_key", ownerLK)
    .order("active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as AppSession;

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userLK = getSessionLandingKey(session);
  const body = await req.json().catch(() => ({}));

  const name = String(body?.name || "").trim();
  const ownerLK = String(body?.owner_landing_key || userLK);

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "담당자 이름을 입력해주세요." },
      { status: 400 }
    );
  }

  if (!canManageOwner(userLK, ownerLK)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden owner_landing_key" },
      { status: 403 }
    );
  }

  const { data: latest, error: latestError } = await supabaseAdmin
    .from("lead_managers")
    .select("sort_order")
    .eq("owner_landing_key", ownerLK)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return NextResponse.json(
      { ok: false, error: latestError.message },
      { status: 500 }
    );
  }

  const nextSortOrder = Number(latest?.sort_order || 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("lead_managers")
    .insert({
      owner_landing_key: ownerLK,
      name,
      active: true,
      sort_order: nextSortOrder,
    })
    .select("id, owner_landing_key, name, active, sort_order, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, item: data });
}