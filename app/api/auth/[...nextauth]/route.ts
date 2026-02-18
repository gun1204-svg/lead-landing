import NextAuth from "next-auth";
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

const handler = NextAuth({
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

        // ✅ 중요: email/name을 채워줘야 세션/미들웨어/서버에서 안정적으로 인식됨
        return { id: user.username, name: user.username, email: user.username };
      },
    }),
  ],

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/admin/login" },

  // ✅ JWT/Session에 user 정보 확실히 주입
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = (user as any).name;
        token.email = (user as any).email;
        token.sub = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || ({} as any);
      (session.user as any).name = token.name;
      (session.user as any).email = token.email;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
