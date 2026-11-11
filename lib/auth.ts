import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getAuthState } from "@/db/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sessionIsCurrent } from "@/lib/auth-rules";

// Keep in sync with the same flag on the login and signup pages.
export const GOOGLE_AUTH_ENABLED = true;

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "development"
    ? "letterstack-local-development-auth-secret"
    : undefined);

/**
 * Find-or-create our own user row for a Google sign-in, returning our uuid.
 * We don't use a NextAuth adapter — the users table is ours — so OAuth
 * identities are linked to accounts by verified email.
 */
async function upsertGoogleUser(email: string, name: string | null) {
  const normalized = email.toLowerCase().trim();
  const [existing] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing) {
    // Backfill a name from Google if the account never had one.
    if (!existing.name && name) {
      await db.update(users).set({ name }).where(eq(users.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(users)
    .values({ email: normalized, name, passwordHash: null })
    .returning({ id: users.id });

  return created.id;
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
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase().trim()))
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
        // Google's `sub` is not our id — map (or create) our user row.
        token.id = await upsertGoogleUser(profile.email, profile.name ?? null);
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
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
