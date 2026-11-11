import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      // Whether the account has proven it owns `email`. Re-read from the
      // database on every request by the jwt callback in lib/auth.ts.
      hasVerifiedEmail: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    // users.session_version at sign-in; a mismatch signs the session out.
    sv?: number;
    emailVerified?: boolean;
  }
}
