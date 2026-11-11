import { cache } from "react";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { claimAccountForGoogle, getAuthState } from "@/db/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sessionIsCurrent } from "@/lib/auth-rules";
import { clientIp, rateLimitAll } from "@/lib/rate-limit";

// Keep in sync with the same flag on the login and signup pages.
export const GOOGLE_AUTH_ENABLED = true;

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "development"
    ? "letterstack-local-development-auth-secret"
    : undefined);

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Surfaces to the login page as `code: "rate_limited"`. */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// The jwt callback runs on every auth() call, and one request can make
// several (layout, page, currentUserId, currentOrganizationId). cache() makes
// that one database read per request inside React rendering; elsewhere (route
// handlers, proxy) it is a plain call.
const loadAuthState = cache(getAuthState);

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Per email so one account can't be guessed at from many IPs, per IP
        // so one machine can't spray many accounts. The per-email limit also
        // means someone can lock an address out of password login for up to
        // 15 minutes; Google sign-in and password reset still work then.
        const limit = await rateLimitAll([
          { key: `login:email:${email}`, rule: { limit: 10, windowMs: FIFTEEN_MINUTES } },
          {
            key: `login:ip:${clientIp(request.headers)}`,
            rule: { limit: 50, windowMs: FIFTEEN_MINUTES },
          },
        ]);
        if (!limit.ok) throw new RateLimitedSignin();

        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // OAuth-only accounts have no password to check.
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(GOOGLE_AUTH_ENABLED
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        // Only allow Google-verified addresses to claim an account.
        return Boolean(profile?.email && profile.email_verified);
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      const signingIn = Boolean(user || account);

      if (account?.provider === "google" && profile?.email) {
        // Google's `sub` is not our id — map (or create) our user row. This
        // may revoke older sessions on the account; see planGoogleClaim.
        const claim = await claimAccountForGoogle(profile.email, profile.name ?? null);
        token.id = claim.id;
      } else if (user) {
        token.id = user.id;
      }

      if (!token.id) return null;

      // Sessions are stateless JWTs, so this re-read is the only way a
      // password reset or change can end sessions already handed out.
      // Returning null clears the cookie and signs the browser out.
      const state = signingIn ? await getAuthState(token.id) : await loadAuthState(token.id);
      if (!state) return null;
      if (signingIn) {
        token.sv = state.sessionVersion;
      } else if (!sessionIsCurrent(token.sv, state)) {
        return null;
      }

      token.email = state.email;
      token.emailVerified = Boolean(state.emailVerifiedAt);
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.hasVerifiedEmail = Boolean(token.emailVerified);
      }
      return session;
    },
  },
});
