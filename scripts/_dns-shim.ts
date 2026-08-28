/**
 * The DNS shim from instrumentation.ts, for scripts.
 *
 * instrumentation.ts only runs inside Next, so every standalone script in
 * this folder dies on the same machine with
 * "getaddrinfo ENOTFOUND api.<...>.aws.neon.tech" — the ISP resolver refuses
 * everything under aws.neon.tech while answering the rest of the internet.
 * See that file for the full diagnosis.
 *
 * This is the same patch without the Edge-runtime contortions: a script is
 * plain Node, so node:dns can just be imported and `lookup` replaced.
 *
 * Call installDnsShim() before the first query. It is a workaround for one
 * machine's network — setting the machine's DNS to 8.8.8.8 / 1.1.1.1 makes
 * both this and instrumentation.ts unnecessary.
 */
import dns from "node:dns";

const DNS_SERVERS = (process.env.DEV_DNS_SERVERS ?? "8.8.8.8,1.1.1.1")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

export function installDnsShim() {
  const resolver = new dns.Resolver();
  resolver.setServers(DNS_SERVERS);

  const systemLookup = dns.lookup;

  function lookup(hostname: string, options: unknown, callback?: LookupCallback) {
    if (typeof options === "function") {
      callback = options as LookupCallback;
      options = {};
    }
    const opts = (typeof options === "number" ? { family: options } : (options ?? {})) as {
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
  console.log(`[dns-shim] resolving via ${DNS_SERVERS.join(", ")}`);
}
