// Campaign rate formulas, defined once for every analytics surface.
//
// The overview page and the per-campaign page used to divide by different
// things (bounces ÷ delivered on one, ÷ total on the other; opens ÷ sent on
// both), so the same campaign showed two different numbers. These are the
// definitions both now use:
//
//   delivery rate    = delivered ÷ sent
//   bounce rate      = bounced ÷ sent       (a bounce is a send that was NOT
//                                            delivered, so dividing by
//                                            delivered inflates it)
//   complaint rate   = complained ÷ delivered (SES measures it this way)
//   open rate        = unique opens ÷ delivered   } estimates: see
//   click rate       = unique clicks ÷ delivered  } docs/architecture.md,
//   click-to-open    = unique clicks ÷ unique opens } "Why opens are
//   unsubscribe rate = unsubscribes ÷ delivered     }  presented as estimates"
//
// "sent" is what LetterStack handed to SES (campaign_recipients marked
// sent); "delivered" is SES's Delivery event count. A rate whose
// denominator is zero is null, not 0% — "no data yet" and "nobody opened"
// are different things and the UI shows them differently.

export type RateInputs = {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opensUnique: number;
  clicksUnique: number;
  unsubscribed?: number;
};

export type CampaignRates = {
  deliveryRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  clickToOpenRate: number | null;
  unsubscribeRate: number | null;
};

/** part ÷ whole as a 0–1 fraction, or null when whole is 0 or missing. */
export function ratio(part: number, whole: number): number | null {
  if (!Number.isFinite(whole) || whole <= 0) return null;
  if (!Number.isFinite(part) || part <= 0) return 0;
  return part / whole;
}

export function campaignRates(input: RateInputs): CampaignRates {
  return {
    deliveryRate: ratio(input.delivered, input.sent),
    bounceRate: ratio(input.bounced, input.sent),
    complaintRate: ratio(input.complained, input.delivered),
    openRate: ratio(input.opensUnique, input.delivered),
    clickRate: ratio(input.clicksUnique, input.delivered),
    clickToOpenRate: ratio(input.clicksUnique, input.opensUnique),
    unsubscribeRate: ratio(input.unsubscribed ?? 0, input.delivered),
  };
}

/** Field-by-field sum, for totals across campaigns or days. */
export function sumRateInputs(rows: RateInputs[]): Required<RateInputs> {
  const total: Required<RateInputs> = {
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    opensUnique: 0,
    clicksUnique: 0,
    unsubscribed: 0,
  };
  for (const row of rows) {
    total.sent += row.sent;
    total.delivered += row.delivered;
    total.bounced += row.bounced;
    total.complained += row.complained;
    total.opensUnique += row.opensUnique;
    total.clicksUnique += row.clicksUnique;
    total.unsubscribed += row.unsubscribed ?? 0;
  }
  return total;
}

/** A rate as a percentage number for charts (null → 0), rounded. */
export function toPercent(rate: number | null, decimals = 1): number {
  if (rate === null) return 0;
  const factor = 10 ** decimals;
  return Math.round(rate * 100 * factor) / factor;
}

/** A rate as display text: "12.5%", or "—" when there is no denominator. */
export function formatRate(rate: number | null, decimals = 1): string {
  if (rate === null) return "—";
  return `${toPercent(rate, decimals)}%`;
}
