import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminUser = {
  username: string;
  passwordHash: string;
};

function readAdminUsers(): AdminUser[] {
  try {
    const raw = process.env.ADMIN_USERS;
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (u) =>
        u &&
        typeof u.username === "string" &&
        typeof u.passwordHash === "string"
    );
  } catch {
    return [];
  }
}

function normalizeUsername(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const username = normalizeUsername((session?.user as any)?.email);
    const role = String((session?.user as any)?.role ?? "");

    if (!username || role !== "admin") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const currentPassword = String(body?.current_password ?? "");
    const newPassword = String(body?.new_password ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "PASSWORD_REQUIRED" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "PASSWORD_TOO_SHORT" },
        { status: 400 }
      );
    }

    if (newPassword.length > 72) {
      return NextResponse.json(
        { error: "PASSWORD_TOO_LONG" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "SAME_PASSWORD" },
        { status: 400 }
      );
    }

    const envUsers = readAdminUsers();
    const envUser = envUsers.find(
      (u) => u.username.toLowerCase() === username
    );

    if (!envUser) {
      return NextResponse.json(
        { error: "ACCOUNT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("admin_accounts")
      .select("admin_id, password_hash")
      .eq("admin_id", username)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      console.error("change-password account lookup error:", accountError);

      return NextResponse.json(
        { error: "ACCOUNT_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: "ACCOUNT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const dbHash = String(account.password_hash ?? "").trim();
    const currentHash = dbHash || envUser.passwordHash;

    const currentPasswordOk = await bcrypt.compare(
      currentPassword,
      currentHash
    );

    if (!currentPasswordOk) {
      return NextResponse.json(
        { error: "INVALID_CURRENT_PASSWORD" },
        { status: 400 }
      );
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, currentHash);

    if (sameAsCurrent) {
      return NextResponse.json(
        { error: "SAME_PASSWORD" },
        { status: 400 }
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await supabaseAdmin
      .from("admin_accounts")
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("admin_id", username);

    if (updateError) {
      console.error("change-password update error:", updateError);

      return NextResponse.json(
        { error: "PASSWORD_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("change-password exception:", e);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
