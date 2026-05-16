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

function normalizeLandingKey(value: unknown): string {
  const raw = String(value || "").trim();

  if (!raw) return "00";
  if (/^\d+$/.test(raw)) return raw.padStart(2, "0").slice(-2);

  return raw;
}

function getAllowedLandingKeys(userLK: string): string[] | null {
  if (userLK === "00") return null;

  // 02 어드민은 02/03 통합 확인
  if (userLK === "02") return ["02", "03"];

  return [userLK];
}

function canAccessTarget(userLK: string, targetLK: string): boolean {
  if (userLK === "00") return true;
  if (userLK === "02") return targetLK === "02" || targetLK === "03";
  return userLK === targetLK;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userLK = normalizeLandingKey(user.landing_key || "00");

  const { searchParams } = new URL(req.url);
  const targetLKRaw = searchParams.get("landing_key");
  const targetLK = targetLKRaw ? normalizeLandingKey(targetLKRaw) : "";
  const limitRaw = Number(searchParams.get("limit") || 30);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(limitRaw, 100))
    : 30;

  if (targetLK && !canAccessTarget(userLK, targetLK)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  let query = supabaseAdmin
    .from("account_balance_logs")
    .select(
      [
        "id",
        "admin_id",
        "charge_landing_key",
        "lead_landing_key",
        "lead_id",
        "change_type",
        "amount",
        "before_balance",
        "after_balance",
        "price_per_lead",
        "reason",
        "created_by",
        "created_at",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (targetLK) {
    query = query.or(
      `charge_landing_key.eq.${targetLK},lead_landing_key.eq.${targetLK}`
    );
  } else {
    const allowed = getAllowedLandingKeys(userLK);

    if (allowed) {
      const inList = allowed.join(",");
      query = query.or(
        `charge_landing_key.in.(${inList}),lead_landing_key.in.(${inList})`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    items: data || [],
  });
}