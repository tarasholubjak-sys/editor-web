/**
 * NextAuth (Auth.js v5) — Google OAuth з email allowlist.
 *
 * ENV:
 *   AUTH_SECRET           — рандомний рядок 32+ символів (openssl rand -hex 32)
 *   AUTH_GOOGLE_ID        — Client ID з Google Cloud Console
 *   AUTH_GOOGLE_SECRET    — Client Secret з Google Cloud Console
 *   AUTH_TRUST_HOST       — "true" (за nginx-проксі)
 *   ALLOWED_EMAILS        — список через кому: "user1@gmail.com,user2@selfy.com.ua"
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function parseAllowed(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    /**
     * Allowlist: пускаємо тільки email'и зі списку.
     * Якщо ALLOWED_EMAILS не заданий — фейлимо за замовчуванням (security-first).
     */
    async signIn({ profile }) {
      const allowed = parseAllowed();
      if (allowed.size === 0) {
        console.warn("[auth] ALLOWED_EMAILS пустий — нікого не пускаю");
        return false;
      }
      const email = (profile?.email || "").toLowerCase();
      if (!email) return false;
      const ok = allowed.has(email);
      if (!ok) {
        console.warn(`[auth] відхилено: ${email} (не в allowlist)`);
      }
      return ok;
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      // Прокидаємо email у session
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  session: { strategy: "jwt" },
});
