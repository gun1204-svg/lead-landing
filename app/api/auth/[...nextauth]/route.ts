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
      (u) =>
        u &&
        typeof u.username === "string" &&
        typeof u.passwordHash === "string"
    );
  } catch (err) {
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
        if (!users.length) {
          console.log("NO ADMIN_USERS FOUND");
          return null;
        }

        const user = users.find(
          (u) => u.username.toLowerCase() === username
        );

        if (!user) {
          console.log("USERNAME MISMATCH");
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);

        console.log("PW MATCH:", ok);

        if (!ok) return null;

        return {
          id: user.username,
          name: user.username,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/admin/login" },
});

export { handler as GET, handler as POST };
