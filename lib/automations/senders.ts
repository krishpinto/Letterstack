// Which From addresses an automation may send as.
//
// Automations send through SES only (never a connected Gmail mailbox), and SES
// verifies whole domains: once letterstack.site or a customer's domain is
// verified, the account can send as *any* address on it. So the check that
// stops a member sending as billing@letterstack.site, or as an address on
// another customer's verified domain, has to be ours. It is the same rule
// campaigns use (isAllowedFromEmail), scoped to the automation's workspace,
// and it runs both when a flow is saved and again at send time — flows saved
// before this check existed, or whose domain has since been removed, are
// caught at the point of effect.

import { isAllowedFromEmail } from "@/lib/send/sender-identity";
import type { AutomationFlow, SendEmailConfig } from "./flow";

/** The canonical form From addresses are compared and stored in. */
export function normalizeSender(email: string): string {
  return email.trim().toLowerCase();
}

/** Whether a workspace with these verified domains may send as `email`. */
export function isAllowedAutomationSender(
  email: string,
  verifiedDomains: string[],
): boolean {
  const normalized = normalizeSender(email);
  if (!normalized) return false;
  // MAIL_FROM is compared exactly inside isAllowedFromEmail; lowercase it
  // here so a mixed-case env value doesn't reject the shared address.
  const shared = normalizeSender(process.env.MAIL_FROM ?? "");
  if (shared && normalized === shared) return true;
  return isAllowedFromEmail(normalized, verifiedDomains, []);
}

function sendEmailConfigs(flow: AutomationFlow): SendEmailConfig[] {
  return Object.values(flow.nodes)
    .filter((node) => node.type === "send_email")
    .map((node) => node.config as SendEmailConfig);
}

/**
 * Every From address in the flow this workspace may not use. Empty senders
 * are left out: an unconfigured step is a draft, not a spoof, and is handled
 * by the enable check.
 */
export function disallowedSenders(
  flow: AutomationFlow,
  verifiedDomains: string[],
): string[] {
  const bad = new Set<string>();
  for (const config of sendEmailConfigs(flow)) {
    const from = typeof config?.fromEmail === "string" ? config.fromEmail : "";
    if (!normalizeSender(from)) continue;
    if (!isAllowedAutomationSender(from, verifiedDomains)) bad.add(normalizeSender(from));
  }
  return [...bad];
}

/** A copy of the flow with every From address in canonical form. */
export function withNormalizedSenders(flow: AutomationFlow): AutomationFlow {
  const nodes: AutomationFlow["nodes"] = {};
  for (const [id, node] of Object.entries(flow.nodes)) {
    if (node.type === "send_email" && typeof (node.config as SendEmailConfig)?.fromEmail === "string") {
      const config = node.config as SendEmailConfig;
      nodes[id] = { ...node, config: { ...config, fromEmail: normalizeSender(config.fromEmail) } };
    } else {
      nodes[id] = node;
    }
  }
  return { ...flow, nodes };
}
