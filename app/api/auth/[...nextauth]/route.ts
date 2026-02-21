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
    // 운영에서는 굳이 상세 로그를 남기지 않음
    return [];
  }
}

function getLandingKeyFromCallbackUrl(cb: unknown) {
  const s = String(cb ?? "");
  if (!s) return "00";

  try {
    const u = new URL(s, "https://www.bienptns.com");
    const first = u.pathname.split("/")[1]; // "/01/admin/..." -> "01"
    if (/^\d{1,2}$/.test(first)) return first.padStart(2, "0");
  } catch {
    // ignore
  }
  return "00";
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "ID", type: "text" },
        password: { label: "Password", type: "password" },
        landingKey: { label: "LandingKey", type: "text" }, // (폼에서 넘겨도 무해)
      },
      async authorize(creds) {
        const username = (creds?.email || "").trim().toLowerCase();
        const password = (creds?.password || "").toString();

        if (!username || !password) return null;

        const users = readAdminUsers();
        if (!users.length) return null;

        const user = users.find((u) => u.username.toLowerCase() === username);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // ✅ landing_key는 callbackUrl로 결정 (멀티 랜딩 안정판)
        const landing_key = getLandingKeyFromCallbackUrl((creds as any)?.callbackUrl);

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