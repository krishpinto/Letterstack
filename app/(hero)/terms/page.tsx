import type { Metadata } from "next";

import { LegalShell, type LegalSection } from "../_components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service — LetterStack",
  description:
    "The agreement between you and LetterStack: what you can send, what we owe you, plans and billing, and how either side can end it.",
};

const UPDATED = "28 August 2026";

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    heading: "This agreement",
    blocks: [
      "These Terms are a binding agreement between you and [YOUR FULL NAME], a sole proprietor based in [CITY], [STATE], India, trading as LetterStack (we, us, our). They govern your use of letterstack.site and everything we offer through it.",
      "By creating an account, or by using the service at all, you accept these Terms. If you are accepting on behalf of an organisation, you confirm you have the authority to bind it, and you and it are both bound.",
      "Our Privacy Policy is part of this agreement. Read it: it explains, among other things, that the mailing lists you upload remain yours and that we process them only on your instructions.",
    ],
  },
  {
    id: "eligibility",
    heading: "Who may use LetterStack",
    blocks: [
      "You must be at least 18 and legally able to enter a contract. You may not use the service if we have previously terminated your account, or if the law where you are prohibits it.",
      "You are responsible for everything done under your account, for keeping your password safe, and for the people you invite into your workspaces. Tell us at once if you suspect unauthorised access.",
    ],
  },
  {
    id: "the-service",
    heading: "What the service is",
    blocks: [
      "LetterStack lets you build email campaigns in a block editor, import contact lists, send those campaigns through our sending infrastructure, and see what happened to them.",
      { subheading: "Beta, and what that means for you" },
      "LetterStack is in public beta. It works, real organisations send real campaigns through it, and we run it seriously. It is also young: features change, some are unfinished, and bugs exist that we have not found yet.",
      {
        note: "We do not offer an uptime service level agreement, and we do not promise a delivery rate. Email delivery depends on receiving mail servers, your list quality, and your domain's reputation, none of which is ours to control. If your campaign is time-critical or business-critical, keep that in mind when choosing us.",
      },
      "We may change, suspend or discontinue any part of the service. Where a change removes something you rely on, we will give reasonable notice to account holders.",
    ],
  },
  {
    id: "your-content",
    heading: "Your content and your lists",
    blocks: [
      "Your campaigns, templates, images, contact lists and everything else you put into LetterStack stay yours. We claim no ownership of them.",
      "You grant us a limited, non-exclusive, worldwide licence to host, copy, transmit, display and process that content strictly as needed to run the service for you — compiling your campaign into email-safe HTML, delivering it to the recipients you specify, and showing you the results. That licence exists only to operate the service, ends when you delete the content or close your account, and permits nothing else.",
      "You are responsible for your content being lawful, for holding the rights to everything in it, and for the claims it makes.",
    ],
  },
  {
    id: "acceptable-use",
    heading: "What you may and may not send",
    blocks: [
      "This is the most important section in these Terms, and the one we enforce most seriously. Every LetterStack customer shares sending infrastructure. One sender blasting a bought list can push the whole platform past our provider's bounce and complaint thresholds and take everyone else's sending down. So these rules are not decoration.",
      { subheading: "Consent is required" },
      {
        list: [
          "You may only send to people who gave you permission to email them, or with whom you have a genuine existing relationship that the law where they live recognises as a basis for sending.",
          "You may not send to purchased, rented, scraped, harvested or otherwise acquired lists. This is a ground for immediate termination, not a warning.",
          "You must be able to show, on request, how and when consent was obtained for any address on your list.",
        ],
      },
      { subheading: "Every campaign must" },
      {
        list: [
          "Accurately identify you as the sender, in the From, Reply-To and body. No forged headers, no misleading domains, no impersonating anyone.",
          "Carry a working unsubscribe link, and honour unsubscribes promptly and permanently.",
          "Include a valid postal address or equivalent contact detail where the law requires one.",
          "Have a subject line that reflects what the email actually contains.",
        ],
      },
      { subheading: "You may not use LetterStack to send" },
      {
        list: [
          "Unsolicited bulk email, by any name.",
          "Phishing, credential harvesting, malware, or anything designed to deceive a recipient into handing over money or information.",
          "Content that is unlawful, defamatory, harassing, or that infringes someone's intellectual property or privacy.",
          "Sexually explicit material, content promoting hate or violence, or content harmful to children.",
          "Anything in a category our sending providers prohibit, including get-rich-quick and multi-level marketing schemes, unlicensed pharmaceuticals, and cryptocurrency or trading solicitations.",
        ],
      },
      { subheading: "You must not attack the service" },
      {
        list: [
          "No reverse engineering, scraping, circumventing rate limits or plan allowances, or probing our systems without written permission.",
          "No reselling the service or making it available to third parties as your own product, without our written agreement.",
          "No use of the service to build or train a competing product.",
        ],
      },
    ],
  },
  {
    id: "compliance",
    heading: "Anti-spam law is your responsibility",
    blocks: [
      "You must comply with every law that applies to the mail you send, including where your recipients are, not merely where you are. Depending on your list, that may include the Information Technology Act, 2000 and TRAI regulations in India, the GDPR and ePrivacy rules in the EU, the UK GDPR and PECR, CAN-SPAM in the United States, and CASL in Canada.",
      "You are the controller of your mailing list. We are your processor. That means the legal duty to have consent, to honour rights requests, and to answer for what you send sits with you, and we cannot discharge it for you.",
      "Where the law requires a written data processing agreement between us, these Terms and our Privacy Policy serve as one. Ask us if you need a separate signed document.",
    ],
  },
  {
    id: "enforcement",
    heading: "Sending limits, monitoring and suspension",
    blocks: [
      "We monitor bounce rates, spam complaint rates and sending patterns across the platform. We do this to keep the service deliverable, not to read your mail.",
      "We may, without prior notice where the risk is immediate:",
      {
        list: [
          "Throttle or pause a send that is generating bounce or complaint rates likely to endanger the platform.",
          "Suspend a workspace we reasonably believe is sending to a non-consenting list.",
          "Suppress addresses permanently after a hard bounce or a spam complaint. Suppression is global to your workspace and applies across all your campaigns and imports; you cannot switch it off, and we will not remove a suppression on request.",
          "Terminate an account for a serious or repeated breach of the acceptable use rules.",
        ],
      },
      "Where circumstances allow, we will tell you what we found and give you a chance to fix it before terminating. Where they do not, we will explain afterwards.",
      "Each plan carries a monthly send allowance, a contact ceiling, and limits on sending domains and workspaces. Those figures are published on our pricing page and enforced in the product. Exceeding them blocks the specific action that would exceed them; it does not lock you out of your account or your data.",
    ],
  },
  {
    id: "plans",
    heading: "Plans, payment and refunds",
    blocks: [
      {
        list: [
          "We offer a Free tier and paid tiers. Current names, prices and limits are on our pricing page, which forms part of these Terms.",
          "Paid plans are billed in Indian Rupees, in advance, monthly or annually, through Razorpay. Prices exclude applicable taxes unless we state otherwise.",
          "A paid period runs for the days you bought. When it ends without renewal, the workspace returns to the Free tier. Your lists, drafts and history remain; the Free limits apply from then on.",
          "We may occasionally grant a paid period at no charge. A grant is a perk, not a purchase, carries no refund value, and we may end it on notice.",
          "Our highest tier is not self-serve and is quoted per agreement. Terms specific to it are set out in that agreement, which prevails over this section where they conflict.",
        ],
      },
      { subheading: "Refunds" },
      "Payments are non-refundable except where Indian law requires otherwise, or where we have failed to provide the service and you tell us within 14 days of the charge. If we terminate your account for a breach of the acceptable use rules, no refund is due.",
      "If we increase the price of a plan you are on, we will give at least 30 days' notice by email, and the new price applies from your next renewal. You can cancel before it takes effect.",
    ],
  },
  {
    id: "integrations",
    heading: "Third-party services and the Gmail integration",
    blocks: [
      "LetterStack runs on third-party infrastructure and offers optional integrations. Those services have their own terms, and your use of them through LetterStack is also subject to those terms.",
      "If you connect a Gmail account, you authorise us to send mail on your behalf through the Google account you connect, using the gmail.send permission and nothing wider. You remain bound by Google's own terms and by Gmail's sending limits and bulk sender requirements, which apply to you independently of these Terms and which we cannot waive.",
      "You can disconnect at any time from your settings, or revoke our access in your Google account. We are not responsible for a third party changing, limiting or withdrawing its service, though we will tell you if it affects you.",
    ],
  },
  {
    id: "ip",
    heading: "Our intellectual property",
    blocks: [
      "The LetterStack software, brand, design and documentation are ours and stay ours. These Terms grant you a limited, revocable, non-transferable right to use the service, and nothing more.",
      "If you send us feedback or suggestions, we may use them freely and without obligation to you. We appreciate them; we are not going to run a royalty ledger for them.",
    ],
  },
  {
    id: "termination",
    heading: "Ending the agreement",
    blocks: [
      "You may stop using LetterStack and delete your account at any time, from your settings. Doing so ends any paid period without refund of the unused part.",
      "We may suspend or terminate your account for a material breach of these Terms, for non-payment, or where the law requires. Except in cases of serious abuse, we will give notice and a reasonable chance to put it right.",
      "On termination, your right to use the service ends immediately. We keep your data for the periods set out in the Privacy Policy, so you have a window to ask for an export, and suppression records survive termination permanently. Export your data before you delete an account: after the retention window, it is gone.",
    ],
  },
  {
    id: "warranties",
    heading: "Disclaimers",
    blocks: [
      "The service is provided as is and as available. To the fullest extent the law allows, we disclaim all warranties not expressly stated here, including implied warranties of merchantability, fitness for a particular purpose and non-infringement.",
      "We do not warrant that the service will be uninterrupted or error-free, that every email will be delivered, that any email will be opened, or that reporting figures are exact. Open and click tracking in particular are estimates: mail clients block and pre-fetch images, so these numbers are directional, not authoritative.",
      "Nothing here excludes liability that cannot lawfully be excluded, including for fraud or for death or personal injury caused by negligence.",
    ],
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    blocks: [
      "To the fullest extent the law allows, neither party is liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, lost revenue, lost business or lost data, however caused.",
      "Our total aggregate liability arising out of or relating to this agreement, for all claims combined, is limited to the greater of the fees you actually paid us in the 12 months before the event giving rise to the claim, or ₹5,000.",
      "This limit reflects what the service costs. If it is not an acceptable allocation of risk for your use case, LetterStack is not the right tool for that use case, and you should not use it for it.",
    ],
  },
  {
    id: "indemnity",
    heading: "Indemnity",
    blocks: [
      "You will indemnify and hold us harmless against claims, damages, penalties and reasonable legal costs arising from the content you send, from your mailing lists and how you obtained them, from your breach of these Terms or of any anti-spam or data protection law, and from your infringement of anyone's rights.",
      "This matters most where a regulator or a recipient comes after a campaign you sent. We provide the pipe; what goes through it is yours.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to these Terms",
    blocks: [
      "We may update these Terms as the product and the law change. For material changes we will email account holders at least 14 days before they take effect. Continuing to use the service after that means you accept the new version. If you do not, stop using the service and close your account before the change lands.",
    ],
  },
  {
    id: "general",
    heading: "General",
    blocks: [
      {
        list: [
          "Governing law: the laws of India, without regard to conflict-of-law rules.",
          "Jurisdiction: the courts of [CITY], [STATE] have exclusive jurisdiction, and both parties submit to them.",
          "Entire agreement: these Terms and the Privacy Policy are the whole agreement between us about the service, and replace anything said before.",
          "Severability: if a provision is held unenforceable, the rest stays in force and the offending provision is narrowed to the minimum extent needed.",
          "No waiver: not enforcing something once does not waive our right to enforce it later.",
          "Assignment: you may not assign this agreement without our written consent. We may assign it as part of a merger, acquisition or sale of assets, on notice to you.",
          "Force majeure: neither party is liable for failures caused by events beyond reasonable control, including provider outages, network failures and acts of government.",
        ],
      },
      "Questions about these Terms go to legal@letterstack.site.",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <LegalShell
      title="Terms of Service"
      updated={UPDATED}
      summary="The short version: your lists and your content stay yours, you may only mail people who agreed to hear from you, and we will step in if a send threatens everyone else's deliverability. We bill in advance, we make no uptime or delivery guarantee while we are in beta, and our liability is capped at what you have paid us. The long version, which is the one that binds, follows."
      sections={SECTIONS}
    />
  );
}
