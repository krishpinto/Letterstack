import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Google OAuth is wired but switched off: Google requires paid verification
// before the client can be used. Flip this (and the same flag on the login
// and signup pages) when that's sorted.
export const GOOGLE_AUTH_ENABLED = false;

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
      if (account?.provider === "google" && profile?.email) {
        // Google's `sub` is not our id — map (or create) our user row.
        token.id = await upsertGoogleUser(profile.email, profile.name ?? null);
      } else if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
