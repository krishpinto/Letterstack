// The /lab pages and /api/lab routes are unauthenticated developer tools:
// they can send mail through SES, reset send state and render invoices. They
// must only ever run on a developer's machine.
//
// proxy.ts already 404s them in production, but that is one matcher entry
// away from silently not applying, and anything run outside `next dev`
// (a preview deployment, `next start` locally) should refuse them too. So
// each handler checks for itself as well. NODE_ENV is "development" only
// under `next dev`; Vercel previews and production both run "production".

export function isLabEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development";
}

/** A bare 404, so a lab route outside development looks like no route at all. */
export function labGuard(): Response | null {
  return isLabEnabled() ? null : new Response(null, { status: 404 });
}

/** Wrap a route handler so it 404s outside development. */
export function devOnly<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => labGuard() ?? handler(...args);
}
