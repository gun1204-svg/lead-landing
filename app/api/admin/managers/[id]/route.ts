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

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

function getSessionLandingKey(session: AppSession) {
  return normalizeLandingKey(session?.user?.landing_key) || "00";
}

function isRootAdmin(userLK: string) {
  return userLK === "00";
}

function canManageOwner(userLK: string, ownerLK: string) {
  if (isRootAdmin(userLK)) return true;
  return userLK === ownerLK;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions as any)) as AppSession;

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userLK = getSessionLandingKey(session);
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing id" },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("lead_managers")
    .select("id, owner_landing_key")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { ok: false, error: existingError.message },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "담당자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (!canManageOwner(userLK, existing.owner_landing_key)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden manager" },
      { status: 403 }
    );
  }

  const patch: Record<string, any> = {};

  if (typeof body.name !== "undefined") {
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "담당자 이름을 입력해주세요." },
        { status: 400 }
      );
    }

    patch.name = name;
  }

  if (typeof body.active !== "undefined") {
    patch.active = Boolean(body.active);
  }

  if (typeof body.sort_order !== "undefined") {
    patch.sort_order = Number(body.sort_order || 0);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "수정할 값이 없습니다." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("lead_managers")
    .update(patch)
    .eq("id", id)
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
