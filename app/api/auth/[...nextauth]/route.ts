import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = (creds?.email || "").trim().toLowerCase();
        const password = (creds?.password || "").toString();

        const envEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const envHash = (process.env.ADMIN_PASSWORD_HASH || "").trim();

        console.log("LOGIN TRY:", email);
        console.log("ENV EMAIL:", envEmail);
        console.log("HASH LEN:", envHash.length);
        console.log("HASH START:", envHash.slice(0, 12));
        console.log("HASH HAS $2?:", envHash.startsWith("$2"));

        if (!envEmail || !envHash) {
          console.log("ENV MISSING: ADMIN_EMAIL or ADMIN_PASSWORD_HASH");
          return null;
        }

        if (email !== envEmail) {
          console.log("EMAIL MISMATCH");
          return null;
        }

        const ok = await bcrypt.compare(password, envHash);
        console.log("PW MATCH:", ok);

        if (!ok) return null;
        return { id: "admin-1", email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/admin/login" },
});

export { handler as GET, handler as POST };
