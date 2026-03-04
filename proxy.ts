import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "00";
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function getLKFromPath(pathname: string) {
  // /01/admin/... -> 01
  const m = pathname.match(/^\/(\d{1,2})\/admin(\/|$)/);
  if (m) return normalizeLandingKey(m[1]);
  return "00";
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ✅ 보호 대상:
  // 1) /admin/* (루트 리다이렉트용 포함)
  // 2) /00/admin/*, /01/admin/* ...
  // 3) /api/admin/*
  const isAdminPage =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    /^\/\d{2}\/admin(\/|$)/.test(pathname);

  const isAdminApi = pathname.startsWith("/api/admin/");

  const shouldProtect = isAdminPage || isAdminApi;
  if (!shouldProtect) return NextResponse.next();

  // ✅ login 페이지는 통과 (페이지)
  if (!isAdminApi) {
    if (pathname.endsWith("/admin/login") || pathname.includes("/admin/login/")) {
      return NextResponse.next();
    }
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // ✅ 미인증 처리
  if (!token) {
    // API는 401 JSON
    if (isAdminApi) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 페이지는 해당 LK 로그인으로
    const lk = getLKFromPath(pathname); // /01/admin/...이면 01, 아니면 00
    const loginUrl = new URL(`/${lk}/admin/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // ✅ LK 충돌 방지: 토큰 LK와 URL LK가 다르면 차단/리다이렉트
  const tokenLK = normalizeLandingKey((token as any).landing_key);

  // 페이지(/01/admin/...)만 검사
  if (isAdminPage) {
    const urlLK = getLKFromPath(pathname);

    // root(00)는 어디든 OK
    if (tokenLK !== "00" && tokenLK !== urlLK) {
      return NextResponse.redirect(new URL(`/${tokenLK}/admin/leads`, req.url));
    }
  }

  // API(/api/admin/...)는 토큰LK만으로 판단하면 됨.
  // (각 API route에서 이미 landing_key 권한 체크도 하고 있으니 여기선 최소만)

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/:landingKey(\\d{2})/admin/:path*", "/api/admin/:path*"],
};