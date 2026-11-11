// Rate limits for the public subscribe endpoint (/api/public/subscribe).
//
// Forms are single opt-in and the endpoint is open to any origin, so anyone
// holding a form's public key (it is in the page source of every site that
// embeds it) can post addresses into that workspace's audience. Without a
// limit, a script can "list bomb": sign thousands of strangers up, who then
// get the workspace's welcome automation and its next campaign, complain, and
// push the shared SES account toward suspension.
//
// Three counters, all shared across serverless instances (lib/rate-limit.ts):
//   - one visitor on one form: a person retrying a typo is fine, a loop isn't;
//   - one visitor across every form: stops one IP walking through many keys;
//   - one form across every visitor: caps a distributed attack on one list.
// The per-form ceiling is far above what a real signup page sees, so it only
// bites under attack.

import type { RateLimitRule } from "@/lib/rate-limit";

const MINUTE = 60_000;

export const SUBSCRIBE_LIMITS = {
  perIpPerForm: { limit: 5, windowMs: 10 * MINUTE },
  perIp: { limit: 20, windowMs: 60 * MINUTE },
  perForm: { limit: 300, windowMs: 60 * MINUTE },
} satisfies Record<string, RateLimitRule>;

/** The counters one subscribe request is checked against. */
export function subscribeRateLimitChecks(
  formKey: string,
  ip: string,
): Array<{ key: string; rule: RateLimitRule }> {
  return [
    { key: `subscribe:form:${formKey}:ip:${ip}`, rule: SUBSCRIBE_LIMITS.perIpPerForm },
    { key: `subscribe:ip:${ip}`, rule: SUBSCRIBE_LIMITS.perIp },
    { key: `subscribe:form:${formKey}`, rule: SUBSCRIBE_LIMITS.perForm },
  ];
}
