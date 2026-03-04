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
    return [];
  }
}

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

function getLandingKeyFromCallbackUrl(cb: unknown) {
  const s = String(cb ?? "");
  if (!s) return null;

  try {
    const u = new URL(s, "https://www.bienptns.com");
    const first = u.pathname.split("/")[1]; // "/01/admin/..." -> "01"
    return normalizeLandingKey(first);
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "ID", type: "text" },
        password: { label: "Password", type: "password" },
        landingKey: { label: "LandingKey", type: "text" }, // ✅ 로그인 페이지에서 URL 기반으로 넣어줌
      },
      async authorize(creds) {
        const username = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");

        if (!username || !password) return null;

        const users = readAdminUsers();
        if (!users.length) return null;

        const user = users.find((u) => u.username.toLowerCase() === username);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // ✅ landing_key 결정 우선순위:
        // 1) creds.landingKey (가장 안정적)
        // 2) creds.callbackUrl (fallback)
        // 3) "00"
        const lk1 = normalizeLandingKey((creds as any)?.landingKey);
        const lk2 = getLandingKeyFromCallbackUrl((creds as any)?.callbackUrl);
        const landing_key = lk1 ?? lk2 ?? "00";

        // ✅ 규칙 강제: 루트는 admin만, /01은 admin01만
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
      },
    }),
  ],

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  // ✅ 멀티 랜딩이면 signIn을 고정 경로로 박아두면 꼬일 수 있음.
  // pages: { signIn: "/admin/login" },

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