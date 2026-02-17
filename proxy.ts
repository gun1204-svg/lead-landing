import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    const url = req.nextUrl;

    // 🔥 www → apex 리다이렉트
    if (url.hostname === "www.bienptns.com") {
      url.hostname = "bienptns.com";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/admin/login",
    },
  }
);

export const config = {
  matcher: [
    "/admin((?!/login).*)",
    "/api/admin/:path*",
  ],
};
