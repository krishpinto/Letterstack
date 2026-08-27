/**
 * Development-only DNS shim.
 *
 * Some consumer ISP resolvers (seen on a Reliance/Jio router) answer "query
 * refused" for everything under `aws.neon.tech`, while resolving the rest of
 * the internet — including `api.neon.tech` — perfectly well. The route to
 * Neon is fine; TLS completes and the endpoint answers when reached by IP.
 * Only name resolution is broken.
 *
 * The failure is invisible where it happens. Every query dies as
 * "NeonDbError: fetch failed", and when that lands inside the Auth.js sign-in
 * callback it surfaces to the browser as a bare "There is a problem with the
 * server configuration" — which points at config that is, in fact, correct.
 *
 * So in development we resolve names through a public resolver and fall back
 * to the system one whenever it fails, which leaves every other host behaving
 * exactly as before. Production never loads this: Vercel resolves DNS from its
 * own network and has no such problem.
 *
 * This is a workaround for one machine's network, not a fix. Setting the
 * machine's DNS to 8.8.8.8 / 1.1.1.1 makes it unnecessary — at which point
 * this file can be deleted, and `drizzle-kit studio`, `db:push` and every
 * other tool that talks to Neon start working too, which this shim does not
 * help with.
 */

/** Resolvers to try before falling back to the system one. */
const DNS_SERVERS = (process.env.DEV_DNS_SERVERS ?? "8.8.8.8,1.1.1.1")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function register() {
  if (process.env.NODE_ENV !== "development") return;
  // Only the Node.js runtime — the edge sandbox has no `node:dns` to patch.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Node hands back the CommonJS module object here, which matters twice
  // over: the ESM namespace for a builtin is sealed and cannot be patched,
  // and this needs no import statement at all. Next compiles this file for
  // the Edge runtime as well as Node, and a literal `import("node:module")`
  // fails that build even behind the runtime guard above — the bundler reads
  // the import before any of this code runs.
  //
  // The object below is the same instance Node's own `net` module reads
  // `lookup` from when it opens a socket, which is what makes the patch take.
  //
  // The key is assembled at runtime rather than written out: Next compiles
  // this file for the Edge runtime too, and its static scan rejects any
  // literal mention of a Node-only API — failing that build even though the
  // guard above means the line never executes there.
  const getBuiltinModule = (process as unknown as Record<string, unknown>)[
    ["get", "Builtin", "Module"].join("")
  ] as (id: string) => typeof import("node:dns");

  const dns = getBuiltinModule("node:dns");

  const resolver = new dns.Resolver();
  resolver.setServers(DNS_SERVERS);

  const systemLookup = dns.lookup;

  type LookupCallback = (
    err: NodeJS.ErrnoException | null,
    address: string | Array<{ address: string; family: number }>,
    family?: number,
  ) => void;

  function lookup(hostname: string, options: unknown, callback?: LookupCallback) {
    if (typeof options === "function") {
      callback = options as LookupCallback;
      options = {};
    }
    const opts = (typeof options === "number" ? { family: options } : options ?? {}) as {
      all?: boolean;
      family?: number;
    };
    const done = callback as LookupCallback;

    const fallback = () =>
      (systemLookup as (h: string, o: unknown, cb: LookupCallback) => void)(
        hostname,
        options,
        done,
      );

    const deliver = (list: Array<{ address: string; family: number }>) => {
      if (opts.all) return done(null, list);
      done(null, list[0].address, list[0].family);
    };

    // A/AAAA in sequence, then the system resolver — so a host this resolver
    // cannot answer behaves exactly as it does without the shim.
    resolver.resolve4(hostname, (err4, a4) => {
      if (!err4 && a4?.length) {
        return deliver(a4.map((address) => ({ address, family: 4 })));
      }
      resolver.resolve6(hostname, (err6, a6) => {
        if (!err6 && a6?.length) {
          return deliver(a6.map((address) => ({ address, family: 6 })));
        }
        fallback();
      });
    });
  }

  dns.lookup = lookup as unknown as typeof dns.lookup;

  if (dns.promises) {
    dns.promises.lookup = ((hostname: string, options?: { all?: boolean }) =>
      new Promise((resolve, reject) => {
        lookup(hostname, options ?? {}, (err, address, family) => {
          if (err) return reject(err);
          resolve(options?.all ? address : { address: address as string, family });
        });
      })) as unknown as typeof dns.promises.lookup;
  }

  console.log(`[dns-shim] resolving via ${DNS_SERVERS.join(", ")} (development only)`);
}
