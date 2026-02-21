// app/api/auth/[...nextauth]/route.ts
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

// ✅ admin01 -> "01" / admin02 -> "02" 처럼 아이디에서 landing_key 뽑기
function getLandingKeyFromUsername(username: string) {
  const u = (username || "").trim().toLowerCase();
  const m = u.match(/^admin(\d+)$/);
  if (!m) return null;
  return m[1].padStart(2, "0");
}

// ✅ authOptions를 export (다른 API에서 getServerSession(authOptions)로 쓰기 위함)
export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const username = (creds?.email || "").trim().toLowerCase();
        const password = (creds?.password || "").toString();

        const users = readAdminUsers();

        console.log("LOGIN TRY:", username);
        console.log("USERS COUNT:", users.length);

        if (!username || !password) return null;
        if (!users.length) return null;

        const user = users.find((u) => u.username.toLowerCase() === username);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        console.log("PW MATCH:", ok);
        if (!ok) return null;

        const landing_key = getLandingKeyFromUsername(user.username);

        return {
          id: user.username,
          name: user.username,
          email: user.username,
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