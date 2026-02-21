import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

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
      (u) => u && typeof u.username === "string" && typeof u.passwordHash === "string"
    );
  } catch {
    console.log("ADMIN_USERS JSON PARSE ERROR");
    return [];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "ID", type: "text" },
        password: { label: "Password", type: "password" },
        landingKey: { label: "LandingKey", type: "text" },
      },
      async authorize(creds, req) {
        const username = (creds?.email || "").trim().toLowerCase();
        const password = (creds?.password || "").toString();
        if (!username || !password) return null;

        // ✅ landing_key 결정: callbackUrl -> referer fallback
        const cb = (creds as any)?.callbackUrl || "";
        const referer = req?.headers?.get("referer") || "";

        const pick = cb || referer; // cb가 비면 referer를 사용
        let landing_key = "00";

        try {
        const u = new URL(pick, "https://www.bienptns.com");
        const first = u.pathname.split("/")[1]; // "/01/admin/login" or "/01/admin/leads"
        if (/^\d{1,2}$/.test(first)) landing_key = first.padStart(2, "0");
      } catch {
        // ignore
      }

        // ---- 기존 ADMIN_USERS 검증 그대로 ----
        const users = readAdminUsers();
        if (!users.length) return null;

        const user = users.find((u) => u.username.toLowerCase() === username);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        console.log("PW MATCH:", ok);
        if (!ok) return null;

        // ✅ 규칙 강제 (네 요구사항)
        if (landing_key === "00") {
          if (username !== "admin") return null;
        } else {
          if (username !== `admin${landing_key}`) return null;
        }

        return {
         id: username,
         name: username,
         email: username,
         landing_key,
        } as any;
       }
    }),
  ], // ✅ 콤마 필수

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/admin/login" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = (user as any).name;
        token.email = (user as any).email;
        token.sub = (user as any).id;
        (token as any).landing_key = (user as any).landing_key ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || ({} as any);
      (session.user as any).name = token.name;
      (session.user as any).email = token.email;
      (session.user as any).landing_key = (token as any).landing_key ?? null;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };