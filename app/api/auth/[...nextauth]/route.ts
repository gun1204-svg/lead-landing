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

// ✅ callbackUrl에서 landingKey 뽑기: "/01/admin/..." -> "01"
function getLandingKeyFromCallbackUrl(cb: unknown) {
  const s = String(cb ?? "");
  if (!s) return null;

  try {
    const u = new URL(s, "https://www.bienptns.com");
    const first = u.pathname.split("/")[1];
    return normalizeLandingKey(first);
  } catch {
    return null;
  }
}

function normalizeUsername(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "ID", type: "text" },
        password: { label: "Password", type: "password" },
        landingKey: { label: "LandingKey", type: "text" }, // 로그인 폼이 넣어주는 값
      },

      async authorize(creds) {
        const username = normalizeUsername((creds as any)?.email);
        const password = String((creds as any)?.password ?? "");

        if (!username || !password) return null;

        const users = readAdminUsers();
        if (!users.length) return null;

        const found = users.find((u) => u.username.toLowerCase() === username);
        if (!found) return null;

        const ok = await bcrypt.compare(password, found.passwordHash);
        if (!ok) return null;

        // ✅ landing_key 결정: landingKey(폼) > callbackUrl > "00"
        const lk1 = normalizeLandingKey((creds as any)?.landingKey);
        const lk2 = getLandingKeyFromCallbackUrl((creds as any)?.callbackUrl);
        const landing_key = lk1 ?? lk2 ?? "00";

        // ✅ 규칙 강제
        // - /00 에서는 admin만
        // - /01 에서는 admin01만
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

  // ✅ 멀티랜딩이라 pages.signIn은 고정하지 않는 게 맞음
  // pages: { signIn: "/admin/login" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = (user as any).name;
        token.email = (user as any).email;
        token.sub = (user as any).id;

        // ✅ 무조건 2자리 LK로 박기
        (token as any).landing_key = normalizeLandingKey((user as any).landing_key) ?? "00";
      }
      return token;
    },

    async session({ session, token }) {
      session.user = session.user || ({} as any);
      (session.user as any).name = token.name;
      (session.user as any).email = token.email;

      // ✅ 세션에도 2자리 LK 강제
      (session.user as any).landing_key = normalizeLandingKey((token as any).landing_key) ?? "00";
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };