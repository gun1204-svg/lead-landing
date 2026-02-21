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

        console.log("LOGIN TRY:", username);

        if (!username || !password) {
          console.log("MISSING CREDS");
          return null;
        }

        const users = readAdminUsers();
        console.log("USERS COUNT:", users.length);
        console.log("USERNAMES:", users.map(u => u.username).join(","));

        const user = users.find((u) => u.username.toLowerCase() === username);
        console.log("FOUND USER:", !!user);

        if (!user) {
          console.log("USER NOT FOUND");
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        console.log("PW MATCH:", ok);

        if (!ok) {
          console.log("PASSWORD MISMATCH");
          return null;
        }

        // --- landing_key 계산 부분 ---
        const cb = (creds as any)?.callbackUrl || "";
        console.log("CALLBACKURL:", cb);

        let landing_key = "00";
        try {
          const u = new URL(cb, "https://www.bienptns.com");
          const first = u.pathname.split("/")[1];
          if (/^\d{1,2}$/.test(first)) landing_key = first.padStart(2, "0");
        } catch {}

        console.log("LANDING_KEY:", landing_key);

        // --- 규칙 강제 ---
        if (landing_key === "00") {
          if (username !== "admin") {
            console.log("RULE DENY ROOT");
            return null;
          }
        } else {
           if (username !== `admin${landing_key}`) {
            console.log("RULE DENY LANDING");
            return null;
          }
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