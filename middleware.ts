import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "00";
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ✅ admin 페이지들만 보호 (API는 제외)
  // - /admin/... (리다이렉트용)
  // - /00/admin/...
  // - /01/admin/...
  const isAdminPage =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    /^\/\d{2}\/admin(\/|$)/.test(pathname);

  if (!isAdminPage) {
    return NextResponse.next();
  }

  // ✅ login 페이지는 통과
  if (pathname.endsWith("/admin/login") || pathname.includes("/admin/login/")) {
    return NextResponse.next();
  }

  // ✅ 세션 토큰 확인
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    // 어떤 LK의 admin이냐를 URL에서 추출해서 해당 login으로 보냄
    const parts = pathname.split("/");
    const first = parts[1]; // "", "01", "admin", ...
    const lk = /^\d{1,2}$/.test(first) ? normalizeLandingKey(first) : "00";

    const loginUrl = new URL(`/${lk}/admin/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // ✅ 토큰에 landing_key가 있으면 URL의 LK와 충돌 체크 (선택사항이지만 강력 추천)
  const tokenLK = normalizeLandingKey((token as any).landing_key);

  // URL에 LK가 있는 경우만 검사: /01/admin/...
  const m = pathname.match(/^\/(\d{2})\/admin(\/|$)/);
  if (m) {
    const urlLK = normalizeLandingKey(m[1]);
    // 루트(00)는 어디든 접근 가능
    if (tokenLK !== "00" && tokenLK !== urlLK) {
      const denyUrl = new URL(`/${tokenLK}/admin/leads`, req.url);
      return NextResponse.redirect(denyUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/:landingKey(\\d{2})/admin/:path*"],
};