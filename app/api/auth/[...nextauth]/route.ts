import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminUser = {
  username: string;
  passwordHash: string;
};

function readUsersFromEnv(envKey: string): AdminUser[] {
  try {
    const raw = process.env[envKey];
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (u) =>
        u &&
        typeof u.username === "string" &&
        typeof u.passwordHash === "string"
    );
  } catch {
    return [];
  }
}

function readAdminUsers(): AdminUser[] {
  return readUsersFromEnv("ADMIN_USERS");
}

function readInternalAdminUsers(): AdminUser[] {
  return readUsersFromEnv("INTERNAL_ADMIN_USERS");
}

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

// callbackUrl에서 landingKey 뽑기: "/01/admin/..." -> "01"
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

async function getHospitalAdminPasswordHash(username: string, envHash: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_accounts")
      .select("password_hash")
      .eq("admin_id", username)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("admin password lookup error:", error);
      return envHash;
    }

    const dbHash = String(data?.password_hash ?? "").trim();
    return dbHash || envHash;
  } catch (e) {
    console.error("admin password lookup exception:", e);
    return envHash;
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
        callbackUrl: { label: "CallbackUrl", type: "text" },
        mode: { label: "Mode", type: "text" }, // admin | internal
      },

      async authorize(creds) {
        const username = normalizeUsername((creds as any)?.email);
        const password = String((creds as any)?.password ?? "");
        const mode = String((creds as any)?.mode ?? "admin")
          .trim()
          .toLowerCase();

        if (!username || !password) return null;

        // =========================
        // 내부 전용 로그인
        // INTERNAL_ADMIN_USERS는 기존 ENV 방식 유지
        // =========================
        if (mode === "internal") {
          const users = readInternalAdminUsers();
          if (!users.length) return null;

          const found = users.find(
            (u) => u.username.toLowerCase() === username
          );
          if (!found) return null;

          const ok = await bcrypt.compare(password, found.passwordHash);
          if (!ok) return null;

          return {
            id: username,
            name: username,
            email: username,
            landing_key: "internal",
            role: "internal",
          } as any;
        }

        // =========================
        // 병원용 로그인
        // 1) ADMIN_USERS에서 계정 존재 여부 확인
        // 2) admin_accounts.password_hash가 있으면 DB 비밀번호 우선
        // 3) 아직 변경 전이면 ENV 비밀번호 사용
        // =========================
        const users = readAdminUsers();
        if (!users.length) return null;

        const found = users.find(
          (u) => u.username.toLowerCase() === username
        );
        if (!found) return null;

        const passwordHash = await getHospitalAdminPasswordHash(
          username,
          found.passwordHash
        );

        const ok = await bcrypt.compare(password, passwordHash);
        if (!ok) return null;

        // landing_key 결정: landingKey(폼) > callbackUrl > "00"
        const lk1 = normalizeLandingKey((creds as any)?.landingKey);
        const lk2 = getLandingKeyFromCallbackUrl(
          (creds as any)?.callbackUrl
        );
        const landing_key = lk1 ?? lk2 ?? "00";

        // 규칙 강제
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
          role: "admin",
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = (user as any).name;
        token.email = (user as any).email;
        token.sub = (user as any).id;

        const role = (user as any).role ?? "admin";
        (token as any).role = role;

        if (role === "internal") {
          (token as any).landing_key = "internal";
        } else {
          (token as any).landing_key =
            normalizeLandingKey((user as any).landing_key) ?? "00";
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user = session.user || ({} as any);

      (session.user as any).name = token.name;
      (session.user as any).email = token.email;
      (session.user as any).role = (token as any).role ?? "admin";

      if ((token as any).role === "internal") {
        (session.user as any).landing_key = "internal";
      } else {
        (session.user as any).landing_key =
          normalizeLandingKey((token as any).landing_key) ?? "00";
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
